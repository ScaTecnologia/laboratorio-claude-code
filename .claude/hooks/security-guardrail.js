#!/usr/bin/env node
// ============================================================================
// security-guardrail.js — Hook PreToolUse (Write|Edit)
// ----------------------------------------------------------------------------
// Transforma DUAS regras do CLAUDE.md — hoje apenas "pedidos" que Claude
// "geralmente" obedece — em GARANTIAS determinísticas que não podem ser
// ignoradas:
//
//   1. "Não alterar `.env`"
//   2. "Queries SQL sempre parametrizadas ($1, $2...) — nunca interpolação
//       de string."
//
// Como funciona: lê o JSON do PreToolUse no stdin, inspeciona o conteúdo que
// SERIA gravado (Write.content / Edit.new_string) e, se detectar violação,
// imprime a decisão `deny` no formato do PreToolUse e sai com código 0
// (exit 0 + JSON no stdout = Claude respeita a decisão). Sem violação, sai
// em silêncio e a chamada segue (allow implícito).
// ============================================================================

let raw = '';
process.stdin.on('data', c => (raw += c));
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(raw); } catch { process.exit(0); } // entrada inválida → não bloqueia

  const input = (data && data.tool_input) || {};
  const filePath = String(input.file_path || '');
  // Write usa `content`; Edit usa `new_string`. Verificamos o que for enviado.
  const novoConteudo = String(input.content || input.new_string || '');

  const motivo = detectarViolacao(filePath, novoConteudo);
  if (!motivo) process.exit(0); // nada suspeito → deixa passar

  // Formato de decisão do PreToolUse (ver artigo): deny encerra a chamada.
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: motivo,
    },
  }));
  process.exit(0);
});

// Retorna a mensagem de bloqueio, ou null se estiver tudo certo.
function detectarViolacao(filePath, conteudo) {
  // ---- Regra 1: nunca tocar no .env ------------------------------------
  // Casa `.env`, `.env.local`, `.env.production`, etc. em qualquer pasta.
  if (/(^|[\\/])\.env(\.[\w.-]+)?$/.test(filePath)) {
    return 'CLAUDE.md proíbe alterar arquivos .env. Edição bloqueada pelo '
         + 'hook security-guardrail. Ajuste variáveis de ambiente manualmente.';
  }

  // Só faz sentido varrer SQL em código-fonte.
  if (!/\.(js|py|mjs|cjs|ts)$/i.test(filePath)) return null;
  if (!conteudo) return null;

  // ---- Regra 2: interpolação de VALOR em SQL ---------------------------
  // Calibrado para NÃO acusar o padrão seguro já existente no projeto, ex.:
  //   `UPDATE clientes SET ${campos.join(', ')} WHERE id = $${i}`
  // (monta nomes de coluna internamente + usa placeholders $1). Só marcamos
  // interpolação/concatenação de VALOR, que é o vetor de SQL injection.
  const temSQL = /\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|WHERE|VALUES)\b/i;

  const linhas = conteudo.split('\n');
  for (let n = 0; n < linhas.length; n++) {
    const linha = linhas[n];
    if (!temSQL.test(linha)) continue;

    // (a) Template literal com valor interpolado dentro de aspas: '${...}'
    //     ou "${...}" — sempre injeção de valor.
    if (/['"]\$\{[^}]+\}['"]/.test(linha)) {
      return violacaoSQL(n + 1, linha);
    }

    // (b) Comparação/inserção com interpolação direta de valor:
    //     `= ${id}`, `(${valor})`, `, ${x}` — mas ignora `$${i}` (placeholder
    //     escapado) e fragmentos de coluna com `.join(`.
    if (/(=|\(|,)\s*\$\{(?!\s*\$)(?![^}]*\.join\()[^}]+\}/.test(linha)) {
      return violacaoSQL(n + 1, linha);
    }

    // (c) Concatenação de string montando SQL com variável:
    //     "... WHERE id = " + id   |   'SELECT ...' + filtro
    if (/['"][^'"]*\b(WHERE|VALUES|SET|FROM|LIKE|=)\b[^'"]*['"]\s*\+/i.test(linha)) {
      return violacaoSQL(n + 1, linha);
    }
  }

  return null;
}

function violacaoSQL(linha, trecho) {
  return `CLAUDE.md exige SQL parametrizado ($1, $2...). Interpolação/concatenação `
       + `de valor detectada (linha ${linha}): ${trecho.trim().slice(0, 120)} — `
       + `risco de SQL injection. Use placeholders e passe os valores no array. `
       + `Bloqueado pelo hook security-guardrail.`;
}
