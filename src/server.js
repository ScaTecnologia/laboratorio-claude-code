const http = require('http');
const fs   = require('fs');
const path = require('path');

const usuariosModule = require('./usuarios');
const clientesModule = require('./clientes');
const produtosModule = require('./produtos');
const sessoes        = require('./sessoes');
const mongoModule    = require('./mongo');

const { getSessao, setCookie, parseCookies } = require('./middlewares/auth');

const routeAuth        = require('./routes/auth');
const routeUsuarios    = require('./routes/usuarios');
const routeClientes    = require('./routes/clientes');
const routeFornecedores = require('./routes/fornecedores');
const routeProdutos    = require('./routes/produtos');
const routeEstoque     = require('./routes/estoque');
const routeCarrinho    = require('./routes/carrinho');
const routeAvaliacoes  = require('./routes/avaliacoes');
const routeEventos     = require('./routes/eventos');
const routeRelatorio   = require('./routes/relatorio');

// ── Helpers ───────────────────────────────────────────────────────────────────

function responder(res, status, dados) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(dados));
}

function servirArquivo(res, filePath) {
  const tipos = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json' };
  res.writeHead(200, { 'Content-Type': tipos[path.extname(filePath)] || 'text/plain' });
  res.end(fs.readFileSync(filePath));
}

// ── Server ────────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url     = req.url.split('?')[0];
  const qs      = new URLSearchParams(req.url.includes('?') ? req.url.split('?')[1] : '');
  const partes  = url.split('/').filter(Boolean);
  const recurso = partes[0];
  const id      = partes[1] ? Number(partes[1]) : null;
  const limit   = qs.has('limit')  ? Math.max(1, parseInt(qs.get('limit'),  10) || 10) : null;
  const offset  = qs.has('offset') ? Math.max(0, parseInt(qs.get('offset'), 10) || 0)  : 0;
  const sessao  = await getSessao(req);

  // ── Páginas estáticas ──────────────────────────────────────────────────────

  if (!recurso) return servirArquivo(res, path.join(__dirname, 'public', 'index.html'));
  if (url === '/login.html')        return servirArquivo(res, path.join(__dirname, 'public', 'login.html'));
  if (url === '/fornecedores.html') return servirArquivo(res, path.join(__dirname, 'public', 'fornecedores.html'));
  if (url === '/api-docs')          return servirArquivo(res, path.join(__dirname, 'public', 'swagger.html'));

  // ── Auth ───────────────────────────────────────────────────────────────────

  if (url === '/login'  && req.method === 'POST') return routeAuth.login(req, res);
  if (url === '/logout' && req.method === 'POST') return routeAuth.logout(req, res);
  if (url === '/me'     && req.method === 'GET')  return routeAuth.me(req, res, sessao);

  // ── CRUD Usuários ──────────────────────────────────────────────────────────

  if (recurso === 'usuarios')
    return routeUsuarios.handle(req, res, sessao, id, limit, offset);

  // ── CRUD Clientes ──────────────────────────────────────────────────────────

  if (recurso === 'clientes')
    return routeClientes.handle(req, res, sessao, id, limit, offset);

  // ── CRUD Fornecedores — proxy para Python ──────────────────────────────────

  if (recurso === 'fornecedores')
    return routeFornecedores.handle(req, res, sessao);

  // ── Categorias ─────────────────────────────────────────────────────────────

  if (recurso === 'categorias' && req.method === 'GET') {
    const { listarCategorias } = require('./produtos');
    return responder(res, 200, await listarCategorias());
  }

  // ── CRUD Produtos ──────────────────────────────────────────────────────────

  if (recurso === 'produtos')
    return routeProdutos.handle(req, res, sessao, partes, limit, offset);

  // ── Estoque ────────────────────────────────────────────────────────────────

  if (recurso === 'estoque')
    return routeEstoque.handle(req, res, sessao, partes, qs, limit, offset);

  // ── Carrinho ───────────────────────────────────────────────────────────────

  if (recurso === 'carrinho')
    return routeCarrinho.handle(req, res, sessao, partes, req);

  // ── Avaliações ─────────────────────────────────────────────────────────────

  if (recurso === 'avaliacoes')
    return routeAvaliacoes.handle(req, res, sessao, partes, qs);

  // ── Eventos ────────────────────────────────────────────────────────────────

  if (recurso === 'eventos')
    return routeEventos.handle(req, res, sessao, partes, qs);

  // ── Relatório ──────────────────────────────────────────────────────────────

  if (recurso === 'relatorio')
    return routeRelatorio.handle(req, res, sessao, partes);

  // ── Redis Status ───────────────────────────────────────────────────────────

  if (url === '/redis-status' && req.method === 'GET') {
    if (!sessao) return responder(res, 401, { erro: 'Não autenticado' });
    const redis = require('./redis');
    try {
      const ping   = await redis.ping();
      const chaves = await redis.dbsize();
      return responder(res, 200, { status: ping === 'PONG' ? 'ok' : 'erro', total_chaves: chaves });
    } catch (e) {
      return responder(res, 503, { status: 'indisponível', erro: e.message });
    }
  }

  // ── Arquivos estáticos ─────────────────────────────────────────────────────

  const publicDir = path.join(__dirname, 'public');
  const filePath  = path.resolve(publicDir, url.slice(1));
  if (filePath.startsWith(publicDir) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return servirArquivo(res, filePath);
  }

  responder(res, 404, { erro: 'Rota não encontrada' });
});

// ── Start ─────────────────────────────────────────────────────────────────────

usuariosModule.inicializar()
  .then(() => clientesModule.inicializar())
  .then(() => sessoes.inicializar())
  .then(() => produtosModule.inicializar())
  .then(() => mongoModule.conectar())
  .then(() => server.listen(3000, () => console.log('Servidor rodando em http://localhost:3000')))
  .catch(err => { console.error('Erro ao inicializar:', err.message); process.exit(1); });
