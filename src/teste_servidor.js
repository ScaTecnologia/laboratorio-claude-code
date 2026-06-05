// Valida os endpoints do servidor HTTP após reinício
// Execute com: node src/teste_servidor.js
const http = require('http');

function req(opts, body = null) {
  return new Promise((resolve, reject) => {
    const r = http.request({ hostname: 'localhost', port: 3000, ...opts }, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, headers: res.headers, body: data }); }
      });
    });
    r.on('error', reject);
    if (body) { r.write(JSON.stringify(body)); }
    r.end();
  });
}

function ok(msg)   { console.log('  ✅', msg); }
function fail(msg) { console.error('  ❌', msg); process.exitCode = 1; }
function titulo(t) { console.log(`\n── ${t} ──`); }

async function run() {
  console.log('═══════════════════════════════════════════════');
  console.log('   Validação HTTP do servidor — LabSystem       ');
  console.log('═══════════════════════════════════════════════');

  // ── Login ─────────────────────────────────────────────────────────────────
  titulo('1. Autenticação');
  let cookie;
  try {
    const r = await req(
      { path: '/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
      { email: 'Alexaugusto2@gmail.com', senha: 'admin123' }
    );
    if (r.status === 200 && r.body.nome) {
      ok(`Login OK: ${r.body.nome} (${r.body.role})`);
      cookie = r.headers['set-cookie']?.[0]?.split(';')[0];
    } else {
      fail(`Login falhou: ${JSON.stringify(r.body)}`);
      console.error('\n  Verifique se o servidor foi reiniciado com: node src/server.js\n');
      process.exit(1);
    }
  } catch (e) {
    fail(`Servidor não responde: ${e.message}`);
    console.error('\n  Inicie o servidor: node src/server.js\n');
    process.exit(1);
  }

  const auth = { Cookie: cookie };

  // ── Redis Status ──────────────────────────────────────────────────────────
  titulo('2. Redis Status');
  const rs = await req({ path: '/redis-status', method: 'GET', headers: auth });
  rs.status === 200 && rs.body.status === 'ok'
    ? ok(`/redis-status OK — chaves no store: ${rs.body.total_chaves}`)
    : fail(`/redis-status falhou: ${JSON.stringify(rs.body)}`);

  // ── Categorias ────────────────────────────────────────────────────────────
  titulo('3. Categorias');
  const cats = await req({ path: '/categorias', method: 'GET', headers: auth });
  cats.status === 200 && Array.isArray(cats.body) && cats.body.length > 0
    ? ok(`${cats.body.length} categorias retornadas`)
    : fail(`Categorias: ${JSON.stringify(cats.body)}`);

  // ── Produtos — Cache MISS/HIT ──────────────────────────────────────────────
  titulo('4. Cache de Produtos');
  const p1 = await req({ path: '/produtos', method: 'GET', headers: auth });
  if (p1.status === 200 && p1.body.origem) {
    ok(`1ª consulta: ${p1.body.origem.toUpperCase()} — X-Cache: ${p1.headers['x-cache']} — ${p1.body.dados.length} produto(s)`);
  } else {
    fail(`GET /produtos falhou: ${JSON.stringify(p1.body)}`);
  }

  const p2 = await req({ path: '/produtos', method: 'GET', headers: auth });
  p2.headers['x-cache'] === 'HIT'
    ? ok(`2ª consulta: HIT — dados vindos do cache Redis (TTL: ${p2.headers['x-cache-ttl']}s)`)
    : fail(`2ª consulta deveria ser HIT, foi: ${p2.headers['x-cache']}`);

  // ── Criar produto ─────────────────────────────────────────────────────────
  titulo('5. Criar Produto (invalida cache)');
  const catId = cats.body[0].id;
  const cp = await req(
    { path: '/produtos', method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' } },
    { nome: 'Produto HTTP Test', preco: 149.90, categoria_id: catId, quantidade: 20 }
  );
  let prodId;
  if (cp.status === 201 && cp.body.id) {
    prodId = cp.body.id;
    ok(`Produto criado: id=${prodId}`);
  } else {
    fail(`POST /produtos: ${JSON.stringify(cp.body)}`);
  }

  const p3 = await req({ path: '/produtos', method: 'GET', headers: auth });
  p3.headers['x-cache'] === 'MISS'
    ? ok('Após criar produto: cache invalidado → MISS correto')
    : fail(`Esperado MISS após criar produto, foi: ${p3.headers['x-cache']}`);

  // ── Estoque ────────────────────────────────────────────────────────────────
  titulo('6. Estoque');
  const es = await req({ path: '/estoque', method: 'GET', headers: auth });
  es.status === 200 && Array.isArray(es.body)
    ? ok(`GET /estoque: ${es.body.length} produto(s) com estoque`)
    : fail(`GET /estoque: ${JSON.stringify(es.body)}`);

  if (prodId) {
    const esProd = await req({ path: `/estoque/${prodId}`, method: 'GET', headers: auth });
    esProd.status === 200 && esProd.body.disponivel !== undefined
      ? ok(`Estoque produto ${prodId}: ${esProd.body.quantidade} total, ${esProd.body.disponivel} disponível`)
      : fail(`GET /estoque/${prodId}: ${JSON.stringify(esProd.body)}`);

    // Reserva
    const resv = await req(
      { path: `/estoque/${prodId}/reservar`, method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' } },
      { quantidade: 3 }
    );
    resv.status === 200 && resv.body.totalReservado === 3
      ? ok(`Reserva de 3 unidades: totalReservado=${resv.body.totalReservado}, ttl=${resv.body.ttl}s`)
      : fail(`Reserva: ${JSON.stringify(resv.body)}`);

    // Libera reserva (quantidade via query param)
    const lib = await req(
      { path: `/estoque/${prodId}/reserva?quantidade=3`, method: 'DELETE', headers: auth }
    );
    lib.status === 200
      ? ok(`Reserva liberada: reservado restante = ${lib.body.reservado}`)
      : fail(`Liberar reserva: ${JSON.stringify(lib.body)}`);
  }

  // ── Carrinho ───────────────────────────────────────────────────────────────
  titulo('7. Carrinho');
  const cartVazio = await req({ path: '/carrinho', method: 'GET', headers: auth });
  cartVazio.status === 200
    ? ok(`GET /carrinho: ${cartVazio.body.itens.length} itens (${cartVazio.body.ttl ? `TTL: ${cartVazio.body.ttl}s` : 'vazio'})`)
    : fail(`GET /carrinho: ${JSON.stringify(cartVazio.body)}`);

  if (prodId) {
    // Adiciona item
    const add = await req(
      { path: '/carrinho/itens', method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' } },
      { produtoId: prodId, quantidade: 2 }
    );
    add.status === 200 && add.body.itens.length === 1
      ? ok(`Item adicionado: ${add.body.itens[0].nome} × ${add.body.itens[0].quantidade} (TTL: ${add.body.ttl}s)`)
      : fail(`POST /carrinho/itens: ${JSON.stringify(add.body)}`);

    // Checkout
    const chk = await req({ path: '/carrinho/checkout', method: 'POST', headers: auth });
    chk.status === 200 && chk.body.sucesso
      ? ok(`Checkout: ${chk.body.mensagem}`)
      : fail(`POST /carrinho/checkout: ${JSON.stringify(chk.body)}`);

    // Remove produto de teste
    await req({ path: `/produtos/${prodId}`, method: 'DELETE', headers: auth });
  }

  // ── Resultado ─────────────────────────────────────────────────────────────
  titulo('Resultado');
  if (process.exitCode) {
    console.log('\n  Alguns testes falharam — veja as mensagens ❌ acima.\n');
  } else {
    console.log('\n  ✅ Todos os testes do servidor passaram!\n');
    console.log('  Acesse http://localhost:3000/produtos.html para ver o cache em ação.');
    console.log('  Acesse http://localhost:3000/estoque.html para gerenciar estoque e reservas.');
    console.log('  Acesse http://localhost:3000/carrinho.html para simular o carrinho Black Friday.\n');
  }
}

run().catch(err => { console.error('Erro:', err.message); process.exit(1); });
