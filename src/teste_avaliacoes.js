// Teste completo de Avaliações — execute com: node src/teste_avaliacoes.js
const { conectar }        = require('./mongo');
const avaliacoesModule    = require('./avaliacoes');
const { validar, construir } = require('./models/avaliacao');

function ok(msg)   { console.log('  ✅', msg); }
function fail(msg) { console.error('  ❌', msg); process.exitCode = 1; }
function titulo(t) { console.log(`\n── ${t} ──`); }

async function run() {
  console.log('════════════════════════════════════════════════════');
  console.log('   Teste de Avaliações de Produtos — MongoDB        ');
  console.log('════════════════════════════════════════════════════');

  await conectar();
  await avaliacoesModule.limpar();

  // ── Model: validação ──────────────────────────────────────────────────────
  titulo('1. Validação do Model');

  const errosVazio = validar({});
  errosVazio.length >= 4 ? ok(`Campos obrigatórios detectados: ${errosVazio.length} erro(s)`) : fail('Deveria ter erros em campos vazios');

  const errosNota = validar({ produtoId: 1, clienteId: 1, nota: 9, titulo: 'T', comentario: 'C' });
  errosNota.some(e => e.includes('nota')) ? ok('Nota 9 rejeitada') : fail('Nota 9 deveria ser inválida');

  const semErros = validar({ produtoId: 1, clienteId: 1, nota: 5, titulo: 'Ótimo!', comentario: 'Perfeito.' });
  semErros.length === 0 ? ok('Dados válidos passam sem erro') : fail('Dados válidos não deveriam ter erros: ' + semErros.join(', '));

  // ── Model: construir ──────────────────────────────────────────────────────
  titulo('2. Construtor do documento');

  const doc = construir({
    produtoId: 1, clienteId: 2, nota: 4, titulo: 'Muito bom', comentario: 'Recomendo',
    pros: 'Qualidade, Entrega rápida', contras: 'Preço alto',
    tags: ['recomendo', 'qualidade'], imagens: [],
  });

  doc.status === 'pendente'    ? ok('Status inicial: pendente')          : fail(`Status deveria ser pendente, foi: ${doc.status}`);
  doc.pros.length === 2        ? ok(`Prós parseados: ${doc.pros}`)       : fail(`Prós: esperado 2, recebido ${doc.pros.length}`);
  doc.contras.length === 1     ? ok(`Contras parseados: ${doc.contras}`) : fail(`Contras: esperado 1`);
  doc.tags.length === 2        ? ok(`Tags: ${doc.tags}`)                 : fail(`Tags: esperado 2`);
  doc.dataCriacao instanceof Date ? ok('dataCriacao é um Date')          : fail('dataCriacao deve ser Date');

  // ── CRUD: criar ───────────────────────────────────────────────────────────
  titulo('3. Criar avaliações');

  const av1 = await avaliacoesModule.criar({
    produtoId: 1, clienteId: 1, nota: 5,
    titulo: 'Excelente produto!', comentario: 'Superou minhas expectativas.',
    pros: ['Qualidade', 'Durável'], contras: ['Preço alto'],
    tags: ['recomendo', 'top'], imagens: [],
  });
  av1._id                     ? ok(`Avaliação criada: _id=${av1._id}`)  : fail('_id não gerado');
  av1.nota === 5              ? ok('Nota 5 salva corretamente')          : fail(`Nota: ${av1.nota}`);
  av1.pros.length === 2       ? ok(`Pros salvas: ${av1.pros}`)          : fail('Pros incorretas');
  av1.status === 'pendente'   ? ok('Status: pendente')                  : fail('Status errado');

  await avaliacoesModule.criar({
    produtoId: 1, clienteId: 2, nota: 3,
    titulo: 'Razoável', comentario: 'Esperava mais pela faixa de preço.',
    pros: ['Funcional'], contras: ['Acabamento médio'],
    tags: ['ok'], imagens: [],
  });

  const av3 = await avaliacoesModule.criar({
    produtoId: 2, clienteId: 1, nota: 4,
    titulo: 'Muito bom!', comentario: 'Recomendo para quem busca qualidade.',
    pros: ['Desempenho', 'Design'], contras: [],
    tags: ['bom', 'qualidade'], imagens: [],
  });
  ok(`3 avaliações criadas`);

  // ── CRUD: listar ──────────────────────────────────────────────────────────
  titulo('4. Listar avaliações');

  const { total } = await avaliacoesModule.listar({ limit: 10 });
  total === 3 ? ok(`listar(): ${total} avaliações`) : fail(`Esperado 3, recebido: ${total}`);

  const { avaliacoes: porc1 } = await avaliacoesModule.listar({ clienteId: 1 });
  porc1.length === 2 ? ok(`Filtro clienteId=1: ${porc1.length} avaliações`) : fail(`Esperado 2`);

  // ── CRUD: buscar por ID ───────────────────────────────────────────────────
  titulo('5. Buscar por ObjectId');

  const idStr = String(av1._id);
  const encontrado = await avaliacoesModule.buscarPorId(idStr);
  encontrado?.titulo === 'Excelente produto!' ? ok(`buscarPorId('${idStr.slice(0,8)}...'): encontrado`) : fail('buscarPorId falhou');

  const naoEncontrado = await avaliacoesModule.buscarPorId('000000000000000000000000');
  naoEncontrado === null ? ok('ID inexistente retorna null') : fail('Deveria retornar null');

  // ── Por produto ───────────────────────────────────────────────────────────
  titulo('6. Por produto');

  const { total: total1 } = await avaliacoesModule.porProduto(1);
  total1 === 2 ? ok(`porProduto(1): ${total1} avaliações`) : fail(`Esperado 2, recebido: ${total1}`);

  const { total: total2 } = await avaliacoesModule.porProduto(2);
  total2 === 1 ? ok(`porProduto(2): ${total2} avaliação`) : fail(`Esperado 1, recebido: ${total2}`);

  // ── Por cliente ───────────────────────────────────────────────────────────
  titulo('7. Por cliente');

  const { avaliacoes: cli1 } = await avaliacoesModule.porCliente(1);
  cli1.length === 2 ? ok(`porCliente(1): ${cli1.length} avaliações`) : fail(`Esperado 2`);

  // ── Atualizar ─────────────────────────────────────────────────────────────
  titulo('8. Atualizar avaliação');

  const atualizado = await avaliacoesModule.atualizar(idStr, {
    titulo: 'Produto INCRÍVEL!',
    nota:   4,
    pros:   ['Qualidade premium', 'Suporte excelente'],
  });
  atualizado?.titulo === 'Produto INCRÍVEL!' ? ok('Título atualizado')     : fail('Título não atualizou');
  atualizado?.nota === 4                     ? ok('Nota atualizada para 4') : fail('Nota não atualizou');
  atualizado?.pros.length === 2              ? ok(`Pros atualizados: ${atualizado.pros}`) : fail('Pros não atualizaram');
  atualizado?.status === 'pendente'          ? ok('Status mantido após update')           : fail('Status não deveria mudar');

  // Mudar status
  const aprovado = await avaliacoesModule.atualizar(idStr, { status: 'aprovado' });
  aprovado?.status === 'aprovado' ? ok('Status alterado para aprovado') : fail('Status não alterou');

  // ID inválido
  const naoAchou = await avaliacoesModule.atualizar('000000000000000000000000', { titulo: 'X' });
  naoAchou === null ? ok('Atualizar ID inválido retorna null') : fail('Deveria retornar null');

  // ── Média ─────────────────────────────────────────────────────────────────
  titulo('9. Média de avaliações');

  // av1 está aprovado (nota 4), av2 ainda pendente
  const m1 = await avaliacoesModule.media(1);
  m1.total === 1     ? ok(`média produto 1: ${m1.total} aprovada(s), nota ${m1.media}`) : fail(`Esperado 1, recebido ${m1.total}`);
  m1.media === 4.0   ? ok(`Nota média correta: ${m1.media}`)                            : fail(`Esperado 4.0, recebido: ${m1.media}`);
  m1.distribuicao.length === 5 ? ok('Distribuição com 5 notas')                         : fail('Distribuição errada');

  const mVazio = await avaliacoesModule.media(999);
  mVazio.total === 0 && mVazio.media === null ? ok('Produto sem aprovadas: media=null') : fail('Média sem dados errada');

  // ── Excluir ───────────────────────────────────────────────────────────────
  titulo('10. Excluir avaliação');

  const idAv3 = String(av3._id);
  const deletado = await avaliacoesModule.excluir(idAv3);
  deletado ? ok('Exclusão retornou true') : fail('Deveria retornar true');

  const aposDelete = await avaliacoesModule.buscarPorId(idAv3);
  aposDelete === null ? ok('Avaliação não encontrada após exclusão') : fail('Avaliação deveria ter sido excluída');

  const falso = await avaliacoesModule.excluir('000000000000000000000000');
  falso === false ? ok('Excluir ID inválido retorna false') : fail('Deveria retornar false');

  // ── Seed ──────────────────────────────────────────────────────────────────
  titulo('11. Seed de dados de demonstração');
  await avaliacoesModule.limpar();
  const seed = await avaliacoesModule.semearDados([1, 2]);
  seed.inseridos === 5 ? ok(`Seed: ${seed.inseridos} avaliações criadas`) : fail(`Esperado 5, recebido: ${seed.inseridos}`);

  const { total: totalSeed } = await avaliacoesModule.listar({});
  totalSeed === 5 ? ok(`Total após seed: ${totalSeed}`) : fail(`Esperado 5, recebido: ${totalSeed}`);

  // ── Resultado ─────────────────────────────────────────────────────────────
  titulo('Resultado');
  if (process.exitCode) {
    console.log('\n  Alguns testes falharam — veja as mensagens ❌ acima.\n');
  } else {
    console.log('\n  ✅ Todos os testes de Avaliações passaram!\n');
  }
}

run().catch(err => { console.error('Erro fatal:', err.message, err.stack); process.exit(1); });
