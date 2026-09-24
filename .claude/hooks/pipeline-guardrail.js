#!/usr/bin/env node
// ============================================================================
// pipeline-guardrail.js — Hook PreToolUse (Write|Edit)
// ----------------------------------------------------------------------------
// Garante deterministicamente a regra descrita em docs/ROTEIRO_CICD_CLAUDE_CODE.md
// (Passo 7) e na skill cicd-pipeline:
//
//   "Em workflows de Docker, build e scan podem rodar automaticamente
//    (push/pull_request), mas PUBLICAR imagem e fazer DEPLOY só podem rodar
//    quando disparados manualmente (workflow_dispatch)."
//
// Como funciona: lê o JSON do PreToolUse no stdin e monta o conteúdo que o
// arquivo TERIA depois da edição (Write.content, ou o arquivo atual com
// old_string → new_string no caso do Edit). Se o workflow tiver gatilho
// automático, todo job cujo nome comece com "publish" ou "deploy" precisa de
// um `if:` contendo github.event_name == 'workflow_dispatch'. Senão, `deny`.
// ============================================================================

const fs = require('fs');

let raw = '';
process.stdin.on('data', c => (raw += c));
process.stdin.on('end', () => {
  let data;
  try { data = JSON.parse(raw); } catch { process.exit(0); }

  const input = (data && data.tool_input) || {};
  const filePath = String(input.file_path || '');

  const motivo = detectarViolacao(filePath, conteudoFinal(filePath, input));
  if (!motivo) process.exit(0);

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: motivo,
    },
  }));
  process.exit(0);
});

// Conteúdo do arquivo como ficaria após a ferramenta rodar.
function conteudoFinal(filePath, input) {
  if (typeof input.content === 'string') return input.content; // Write
  if (typeof input.new_string !== 'string') return '';
  let atual;
  try { atual = fs.readFileSync(filePath, 'utf8'); } catch { return input.new_string; }
  const velho = String(input.old_string || '');
  if (!velho) return input.new_string;
  return input.replace_all
    ? atual.split(velho).join(input.new_string)
    : atual.replace(velho, () => input.new_string);
}

function detectarViolacao(filePath, conteudo) {
  // Só se aplica a workflows de Docker dentro de .github/workflows/
  const ehWorkflowDocker = /\.github[\\/]workflows[\\/][^\\/]*docker[^\\/]*\.ya?ml$/i.test(filePath);
  if (!ehWorkflowDocker || !conteudo) return null;

  const linhas = conteudo.split('\n').map(l => l.split('#')[0]);

  // Existe gatilho automático? (aproximação simples, suficiente para YAML de workflow)
  const temGatilhoAuto = linhas.some(l => /^\s{0,4}(push|pull_request|schedule)\s*:/.test(l));
  if (!temGatilhoAuto) return null;

  // Percorre os jobs (chaves com 2 espaços de indentação depois de `jobs:`).
  const inicioJobs = linhas.findIndex(l => /^jobs\s*:/.test(l));
  if (inicioJobs < 0) return null;

  const jobs = [];
  for (let n = inicioJobs + 1; n < linhas.length; n++) {
    const m = linhas[n].match(/^ {2}([\w-]+)\s*:\s*$/);
    if (m) jobs.push({ nome: m[1], linha: n, corpo: [] });
    else if (jobs.length) jobs[jobs.length - 1].corpo.push(linhas[n]);
  }

  for (const job of jobs) {
    if (!/^(publish|deploy)/i.test(job.nome)) continue;
    const protegido = job.corpo.some(l =>
      /^ {4}if\s*:/.test(l) && /github\.event_name\s*==\s*'workflow_dispatch'/.test(l));
    if (!protegido) {
      return `Bloqueado pelo hook pipeline-guardrail: ${filePath} tem gatilho `
           + `automático (push/pull_request/schedule), mas o job "${job.nome}" `
           + `(linha ${job.linha + 1}) não está restrito a disparo manual. `
           + `Adicione ao job: if: \${{ github.event_name == 'workflow_dispatch' && ... }}. `
           + `Build e scan podem ser automáticos; publicar e fazer deploy, não. `
           + `Ver docs/ROTEIRO_CICD_CLAUDE_CODE.md, Passo 7.`;
    }
  }

  return null;
}
