// Teste manual do Redis — execute com: node src/teste_redis.js
// Requer Redis rodando e banco PostgreSQL ativo.
const redis         = require('./redis');
const { garantirBanco, pool } = require('./db');
const produtosModule = require('./produtos');
const estoqueModule  = require('./estoque');
const carrinhoModule = require('./carrinho');

function ok(msg)   { console.log('  ✅', msg); }
function fail(msg) { console.error('  ❌', msg); process.exitCode = 1; }
function titulo(t) { console.log(`\n── ${t} ──`); }

async function run() {
  console.log('═══════════════════════════════════════════');
  console.log('   Teste de integração Redis — LabSystem   ');
  console.log('═══════════════════════════════════════════');

  // ── Conexão Redis ──────────────────────────────────────────────────────────
  titulo('1. Conexão Redis');
  try {
    const pong = await redis.ping();
    pong === 'PONG' ? ok('Redis respondeu PONG') : fail(`Redis respondeu: ${pong}`);
  } catch (e) {
    fail(`Não foi possível conectar: ${e.message}`);
    console.error('\n  Inicie o Redis antes de rodar este teste:');
    console.error('  docker run -d --name redis-lab -p 6379:6379 redis:alpine\n');
    process.exit(1);
  }

  // ── Banco PostgreSQL ───────────────────────────────────────────────────────
  titulo('2. Banco PostgreSQL');
  await garantirBanco();
  await produtosModule.inicializar();
  ok('Banco e tabelas verificados');

  // ── Cache de Produtos ──────────────────────────────────────────────────────
  titulo('3. Cache de produtos (GET /produtos)');

  // Garante que existe ao menos um produto para testar
  const { rows: existentes } = await pool.query('SELECT id FROM produtos LIMIT 1');
  let produtoId;

  if (existentes.length === 0) {
    const { rows: cats } = await pool.query('SELECT id FROM categorias LIMIT 1');
    const catId = cats[0]?.id || null;
    const prod = await produtosModule.criar({
      nome: 'Produto Teste Redis', preco: 99.90, categoria_id: catId, quantidade: 50,
    });
    produtoId = prod.id;
    ok(`Produto de teste criado (id=${produtoId})`);
  } else {
    produtoId = existentes[0].id;
    ok(`Usando produto existente (id=${produtoId})`);
  }

  // Primeira chamada: deve vir do banco (MISS)
  await redis.del('cache:produtos:lista');
  const r1 = await produtosModule.listar();
  r1.origem === 'banco' ? ok('1ª consulta: MISS (banco) — correto') : fail(`1ª consulta deveria ser MISS, veio: ${r1.origem}`);

  // Segunda chamada: deve vir do Redis (HIT)
  const r2 = await produtosModule.listar();
  r2.origem === 'redis' ? ok('2ª consulta: HIT (Redis) — correto') : fail(`2ª consulta deveria ser HIT, veio: ${r2.origem}`);
  ok(`TTL restante no cache: ${r2.ttl}s`);

  // Busca por ID
  await redis.del(`cache:produto:${produtoId}`);
  const rb1 = await produtosModule.buscar(produtoId);
  rb1.origem === 'banco' ? ok(`buscar(${produtoId}) 1ª vez: MISS (banco)`) : fail('Deveria ser MISS');
  const rb2 = await produtosModule.buscar(produtoId);
  rb2.origem === 'redis' ? ok(`buscar(${produtoId}) 2ª vez: HIT (Redis)`) : fail('Deveria ser HIT');

  // ── Invalidação de cache ───────────────────────────────────────────────────
  titulo('4. Invalidação de cache ao atualizar produto');
  await produtosModule.atualizar(produtoId, { descricao: 'Atualizado pelo teste' });
  const cacheDepois = await redis.get(`cache:produto:${produtoId}`);
  const listaDepois = await redis.get('cache:produtos:lista');
  !cacheDepois ? ok('Cache do produto invalidado após atualização') : fail('Cache deveria ter sido removido');
  !listaDepois ? ok('Cache da lista invalidado após atualização') : fail('Cache da lista deveria ter sido removido');

  // ── Estoque + Reservas ─────────────────────────────────────────────────────
  titulo('5. Estoque e reservas no Redis');
  await redis.del(`reserva:${produtoId}`);

  // Garante que tem estoque
  await estoqueModule.atualizar(produtoId, 10);
  ok('Estoque definido: 10 unidades');

  const est1 = await estoqueModule.buscar(produtoId);
  est1.disponivel === 10 ? ok('Disponível: 10 (sem reservas)') : fail(`Disponível esperado: 10, recebido: ${est1.disponivel}`);

  // Reserva 3 unidades
  const r = await estoqueModule.reservar(produtoId, 3);
  r.totalReservado === 3 ? ok(`Reserva de 3 unidades OK (reservado total: ${r.totalReservado})`) : fail('Falha na reserva');

  const est2 = await estoqueModule.buscar(produtoId);
  est2.disponivel === 7 ? ok(`Disponível após reserva: ${est2.disponivel}`) : fail(`Esperado 7, recebido: ${est2.disponivel}`);
  ok(`TTL da reserva: ${est2.reserva_ttl}s`);

  // Tenta reservar além do disponível
  try {
    await estoqueModule.reservar(produtoId, 100);
    fail('Deveria ter rejeitado reserva acima do disponível');
  } catch (e) {
    e.message.includes('insuficiente') ? ok(`Overselling bloqueado: "${e.message}"`) : fail(`Erro inesperado: ${e.message}`);
  }

  // Libera reserva
  await estoqueModule.liberarReserva(produtoId, 3);
  const est3 = await estoqueModule.buscar(produtoId);
  est3.disponivel === 10 ? ok('Reserva liberada, disponível voltou para 10') : fail(`Esperado 10, recebido: ${est3.disponivel}`);

  // ── Carrinho ───────────────────────────────────────────────────────────────
  titulo('6. Carrinho de compras (Redis Hash)');
  const clienteId = 9999; // ID fictício para teste
  await carrinhoModule.limpar(clienteId);

  // Adiciona item
  await carrinhoModule.adicionarItem(clienteId, produtoId, 2);
  const cart1 = await carrinhoModule.obter(clienteId);
  cart1.itens.length === 1 ? ok(`Item adicionado ao carrinho: ${cart1.itens[0].nome} × ${cart1.itens[0].quantidade}`) : fail('Carrinho deveria ter 1 item');
  cart1.ttl > 0 ? ok(`TTL do carrinho: ${cart1.ttl}s`) : fail('Carrinho deveria ter TTL');

  // Remove item
  await carrinhoModule.removerItem(clienteId, produtoId);
  const cart2 = await carrinhoModule.obter(clienteId);
  cart2.itens.length === 0 ? ok('Item removido, carrinho vazio') : fail('Carrinho deveria estar vazio');

  // ── Checkout completo ──────────────────────────────────────────────────────
  titulo('7. Checkout com reserva de estoque');
  await carrinhoModule.adicionarItem(clienteId, produtoId, 2);
  const checkout = await carrinhoModule.checkout(clienteId);
  checkout.sucesso ? ok(`Checkout OK: ${checkout.mensagem}`) : fail('Checkout falhou');
  checkout.reservas.length === 1 ? ok(`${checkout.reservas.length} reserva(s) criada(s)`) : fail('Deveria haver 1 reserva');

  // Verifica que o carrinho foi limpo após checkout
  const cartApos = await carrinhoModule.obter(clienteId);
  cartApos.itens.length === 0 ? ok('Carrinho limpo após checkout') : fail('Carrinho deveria estar vazio');

  // Confirma a venda (simula pagamento aprovado)
  await estoqueModule.confirmarVenda(produtoId, 2);
  const estFinal = await estoqueModule.buscar(produtoId);
  estFinal.quantidade === 8 ? ok(`Venda confirmada: estoque debitado (${estFinal.quantidade} restantes)`) : fail(`Esperado 8, recebido: ${estFinal.quantidade}`);
  !estFinal.reserva_ttl ? ok('Reserva Redis removida após confirmação') : fail('Reserva deveria ter sido removida');

  // ── Limpeza ────────────────────────────────────────────────────────────────
  titulo('Resultado');
  if (process.exitCode) {
    console.log('\n  Alguns testes falharam. Verifique as mensagens ❌ acima.\n');
  } else {
    console.log('\n  ✅ Todos os testes passaram!\n');
  }

  await pool.end();
  redis.disconnect();
}

run().catch(err => {
  console.error('Erro fatal no teste:', err.message);
  process.exit(1);
});
