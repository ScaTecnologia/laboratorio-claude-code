// Teste de integração MongoDB — execute com: node src/teste_mongo.js
const { conectar, getDb, ObjectId } = require('./mongo');
const eventoModule = require('./eventos');

function ok(msg)   { console.log('  ✅', msg); }
function fail(msg) { console.error('  ❌', msg); process.exitCode = 1; }
function titulo(t) { console.log(`\n── ${t} ──`); }

async function run() {
  console.log('══════════════════════════════════════════════');
  console.log('   Teste de integração MongoDB — LabSystem    ');
  console.log('══════════════════════════════════════════════');

  await conectar();

  // ── ObjectId ───────────────────────────────────────────────────────────────
  titulo('1. ObjectId');
  const id1 = new ObjectId();
  const id2 = new ObjectId(id1.toString());
  id1.toString().length === 24 ? ok(`ObjectId gerado: ${id1}`) : fail('ObjectId deve ter 24 chars');
  id1.equals(id2)               ? ok('equals() funciona')      : fail('equals() falhou');

  // ── insertOne / findOne ────────────────────────────────────────────────────
  titulo('2. insertOne + findOne');
  const db  = getDb();
  const col = db.collection('teste_tmp');

  const { insertedId } = await col.insertOne({ nome: 'Teste', valor: 42, ts: new Date() });
  insertedId ? ok(`Documento inserido: ${insertedId}`) : fail('insertedId não retornado');

  const doc = await col.findOne({ nome: 'Teste' });
  doc && doc.valor === 42 ? ok('findOne encontrou o documento') : fail('findOne falhou');

  // ── countDocuments ─────────────────────────────────────────────────────────
  titulo('3. countDocuments + deleteMany');
  await col.insertMany([{ x: 1 }, { x: 2 }, { x: 3 }]);
  const count = await col.countDocuments({ x: { $gte: 2 } });
  count === 2 ? ok(`countDocuments com $gte: ${count}`) : fail(`Esperado 2, recebido: ${count}`);

  await col.deleteMany({});
  const countAfter = await col.countDocuments({});
  countAfter === 0 ? ok('deleteMany limpou a collection') : fail(`Esperado 0, recebido: ${countAfter}`);

  // ── find com sort e limit ──────────────────────────────────────────────────
  titulo('4. find + sort + limit');
  await col.insertMany([{ v: 10 }, { v: 30 }, { v: 20 }, { v: 50 }, { v: 40 }]);
  const top3 = await col.find({}).sort({ v: -1 }).limit(3).toArray();
  top3.length === 3      ? ok(`limit(3): ${top3.length} docs retornados`) : fail(`Esperado 3, recebido: ${top3.length}`);
  top3[0].v === 50       ? ok(`sort desc: primeiro = ${top3[0].v}`)       : fail(`Primeiro deveria ser 50, foi: ${top3[0].v}`);
  await col.deleteMany({});

  // ── Aggregation: $group + $sum ─────────────────────────────────────────────
  titulo('5. Aggregation: $group + $sum + $sort');
  await col.insertMany([
    { cat: 'A', val: 10 }, { cat: 'B', val: 20 },
    { cat: 'A', val: 15 }, { cat: 'B', val: 5 },
    { cat: 'C', val: 30 },
  ]);

  const grupado = await col.aggregate([
    { $group: { _id: '$cat', total: { $sum: '$val' }, count: { $sum: 1 } } },
    { $sort: { total: -1 } },
  ]).toArray();

  grupado.length === 3               ? ok(`$group: ${grupado.length} grupos`)        : fail(`Esperado 3 grupos, recebido: ${grupado.length}`);
  grupado[0]._id === 'C'             ? ok(`$sort desc: primeiro grupo = ${grupado[0]._id}`) : fail(`Primeiro deveria ser C, foi: ${grupado[0]._id}`);
  grupado.find(g => g._id === 'A')?.total === 25 ? ok('$sum: total de A = 25')       : fail('$sum falhou para grupo A');
  await col.deleteMany({});

  // ── Aggregation: $match + $limit ───────────────────────────────────────────
  titulo('6. Aggregation: $match + $limit');
  await col.insertMany([
    { tipo: 'X', n: 1 }, { tipo: 'Y', n: 2 }, { tipo: 'X', n: 3 },
    { tipo: 'X', n: 4 }, { tipo: 'Y', n: 5 },
  ]);

  const filtrado = await col.aggregate([
    { $match: { tipo: 'X' } },
    { $sort: { n: -1 } },
    { $limit: 2 },
  ]).toArray();

  filtrado.length === 2   ? ok(`$match + $limit: ${filtrado.length} docs`) : fail(`Esperado 2, recebido: ${filtrado.length}`);
  filtrado[0].n === 4     ? ok(`Primeiro n = ${filtrado[0].n}`)            : fail(`Esperado 4, recebido: ${filtrado[0].n}`);
  await col.deleteMany({});

  // ── Serviço de Eventos ─────────────────────────────────────────────────────
  titulo('7. Serviço de Eventos — registrar e consultar');
  await eventoModule.limpar();

  await eventoModule.registrar({ tipo: eventoModule.TIPOS.PRODUTO_VISUALIZADO, clienteId: 1, clienteNome: 'Alice',
    dados: { produtoId: 10, produtoNome: 'Smart TV', preco: 2499.90 } });
  await eventoModule.registrar({ tipo: eventoModule.TIPOS.ADICIONADO_CARRINHO, clienteId: 1, clienteNome: 'Alice',
    dados: { produtoId: 10, produtoNome: 'Smart TV', quantidade: 1, preco: 2499.90 } });
  await eventoModule.registrar({ tipo: eventoModule.TIPOS.PEDIDO_CRIADO, clienteId: 2, clienteNome: 'Bruno',
    dados: { pedidoId: 'PED-TEST-1', total: 2499.90, itens: 1 } });
  await eventoModule.registrar({ tipo: eventoModule.TIPOS.PAGAMENTO_APROVADO, clienteId: 2, clienteNome: 'Bruno',
    dados: { pedidoId: 'PED-TEST-1', valor: 2499.90, metodo: 'pix' } });

  const { eventos: todos, total } = await eventoModule.todos({ limit: 10 });
  total === 4 ? ok(`todos(): ${total} eventos`) : fail(`Esperado 4, recebido: ${total}`);

  const alice = await eventoModule.porCliente(1);
  alice.length === 2 ? ok(`porCliente(1): ${alice.length} eventos`) : fail(`Esperado 2, recebido: ${alice.length}`);

  const pedidoEvts = await eventoModule.porPedido('PED-TEST-1');
  pedidoEvts.length === 2 ? ok(`porPedido('PED-TEST-1'): ${pedidoEvts.length} eventos`) : fail(`Esperado 2, recebido: ${pedidoEvts.length}`);

  // ── Relatório Black Friday ─────────────────────────────────────────────────
  titulo('8. Relatório Black Friday');
  await eventoModule.limpar();
  const seed = await eventoModule.semearDados();
  seed.inseridos >= 100 ? ok(`Seed: ${seed.inseridos} eventos criados`) : fail(`Poucos eventos: ${seed.inseridos}`);

  const rel = await eventoModule.relatorioBlackFriday();
  rel.totalEventos >= 100             ? ok(`totalEventos: ${rel.totalEventos}`)             : fail(`Esperado >=100, recebido: ${rel.totalEventos}`);
  rel.funil.length === 6              ? ok(`Funil com ${rel.funil.length} etapas`)           : fail(`Funil deve ter 6 etapas`);
  rel.topVisualizados.length > 0      ? ok(`Top visualizados: ${rel.topVisualizados.length} produtos`) : fail('topVisualizados vazio');
  rel.receita >= 0                    ? ok(`Receita total: R$ ${rel.receita}`)               : fail('Receita negativa');
  rel.porHora.length === 24           ? ok('porHora: 24 slots de hora')                      : fail('porHora deve ter 24 slots');

  // Verifica funil em ordem
  const funil = rel.funil;
  funil[0].tipo === 'PRODUTO_VISUALIZADO' ? ok('Primeiro do funil: PRODUTO_VISUALIZADO') : fail('Ordem do funil errada');
  funil[0].count >= funil[2].count        ? ok('Funil em ordem decrescente')             : fail('Funil deveria ser decrescente');

  // ── Limpeza ────────────────────────────────────────────────────────────────
  await eventoModule.limpar();

  titulo('Resultado');
  if (process.exitCode) {
    console.log('\n  Alguns testes falharam. Veja as mensagens ❌ acima.\n');
  } else {
    console.log('\n  ✅ Todos os testes MongoDB passaram!\n');
  }
}

run().catch(err => { console.error('Erro fatal:', err.message); process.exit(1); });
