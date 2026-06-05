const http = require('http');
const fs   = require('fs');
const path = require('path');

const usuariosModule = require('./usuarios');
const clientesModule = require('./clientes');
const sessoes        = require('./sessoes');

// ── Helpers ───────────────────────────────────────────────────────────────────

function lerBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch { resolve({}); } });
  });
}

function responder(res, status, dados) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(dados));
}

function parseCookies(req) {
  const cookies = {};
  (req.headers.cookie || '').split(';').forEach(part => {
    const [name, ...rest] = part.trim().split('=');
    if (name) cookies[name.trim()] = rest.join('=').trim();
  });
  return cookies;
}

function getSessao(req) {
  return sessoes.buscar(parseCookies(req).sessao_id);
}

function setCookie(res, name, value, opts = {}) {
  let cookie = `${name}=${value}; HttpOnly; Path=/`;
  if (opts.maxAge !== undefined) cookie += `; Max-Age=${opts.maxAge}`;
  res.setHeader('Set-Cookie', cookie);
}

function servirArquivo(res, filePath) {
  const tipos = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json' };
  res.writeHead(200, { 'Content-Type': tipos[path.extname(filePath)] || 'text/plain' });
  res.end(fs.readFileSync(filePath));
}

function proxyParaPython(req, res) {
  return new Promise(resolve => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: req.url,
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
    };
    const proxyReq = http.request(options, proxyRes => {
      res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
      proxyRes.pipe(res, { end: true });
      resolve();
    });
    proxyReq.on('error', () => {
      responder(res, 502, { erro: 'Serviço de fornecedores indisponível. Inicie o servidor Python: python src/fornecedores_api.py' });
      resolve();
    });
    req.pipe(proxyReq, { end: true });
  });
}

// ── Server ────────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url    = req.url.split('?')[0];
  const partes = url.split('/').filter(Boolean);
  const recurso = partes[0];
  const id      = partes[1] ? Number(partes[1]) : null;
  const sessao  = getSessao(req);

  // ── Páginas estáticas ──────────────────────────────────────────────────────

  if (!recurso) return servirArquivo(res, path.join(__dirname, 'public', 'index.html'));
  if (url === '/login.html')        return servirArquivo(res, path.join(__dirname, 'public', 'login.html'));
  if (url === '/fornecedores.html') return servirArquivo(res, path.join(__dirname, 'public', 'fornecedores.html'));
  if (url === '/api-docs')          return servirArquivo(res, path.join(__dirname, 'public', 'swagger.html'));

  // ── Auth ───────────────────────────────────────────────────────────────────

  if (url === '/login' && req.method === 'POST') {
    const { email, senha } = await lerBody(req);
    if (!email || !senha) return responder(res, 400, { erro: 'E-mail e senha são obrigatórios' });
    const usuario = await usuariosModule.buscarPorEmail(email);
    if (!usuario) return responder(res, 401, { erro: 'Credenciais inválidas' });
    const ok = await usuariosModule.verificarSenha(senha, usuario.senha);
    if (!ok) return responder(res, 401, { erro: 'Credenciais inválidas' });
    const sessaoId = sessoes.criar({ userId: usuario.id, role: usuario.role, nome: usuario.nome });
    setCookie(res, 'sessao_id', sessaoId, { maxAge: 86400 * 7 });
    return responder(res, 200, { id: usuario.id, nome: usuario.nome, role: usuario.role });
  }

  if (url === '/logout' && req.method === 'POST') {
    const { sessao_id } = parseCookies(req);
    if (sessao_id) sessoes.encerrar(sessao_id);
    setCookie(res, 'sessao_id', '', { maxAge: 0 });
    return responder(res, 200, { mensagem: 'Sessão encerrada' });
  }

  if (url === '/me' && req.method === 'GET') {
    if (!sessao) return responder(res, 401, { erro: 'Não autenticado' });
    return responder(res, 200, { id: sessao.userId, nome: sessao.nome, role: sessao.role });
  }

  // ── CRUD Usuários — Admin only ─────────────────────────────────────────────

  if (recurso === 'usuarios') {
    if (!sessao)                  return responder(res, 401, { erro: 'Não autenticado' });
    if (sessao.role !== 'Admin')  return responder(res, 403, { erro: 'Acesso restrito a administradores' });

    if (req.method === 'GET' && !id)  return responder(res, 200, await usuariosModule.listar());
    if (req.method === 'GET' && id) {
      const u = await usuariosModule.buscar(id);
      return u ? responder(res, 200, u) : responder(res, 404, { erro: 'Usuário não encontrado' });
    }
    if (req.method === 'POST') {
      const { nome, email, senha, role } = await lerBody(req);
      if (!nome || !email || !senha) return responder(res, 400, { erro: 'Nome, e-mail e senha são obrigatórios' });
      const u = await usuariosModule.criar(nome, email, senha, role || 'Atendente');
      return responder(res, 201, u);
    }
    if (req.method === 'PUT' && id) {
      const body = await lerBody(req);
      const u = await usuariosModule.atualizar(id, body);
      return u ? responder(res, 200, u) : responder(res, 404, { erro: 'Usuário não encontrado' });
    }
    if (req.method === 'DELETE' && id) {
      if (id === 1) return responder(res, 400, { erro: 'Não é possível remover o administrador principal' });
      const ok = await usuariosModule.deletar(id);
      return ok ? responder(res, 200, { mensagem: 'Usuário removido' }) : responder(res, 404, { erro: 'Usuário não encontrado' });
    }
    return responder(res, 405, { erro: 'Método não permitido' });
  }

  // ── CRUD Clientes — autenticado ────────────────────────────────────────────

  if (recurso === 'clientes') {
    if (!sessao) return responder(res, 401, { erro: 'Não autenticado' });

    if (req.method === 'GET' && !id)  return responder(res, 200, await clientesModule.listar());
    if (req.method === 'GET' && id) {
      const c = await clientesModule.buscar(id);
      return c ? responder(res, 200, c) : responder(res, 404, { erro: 'Cliente não encontrado' });
    }
    if (req.method === 'POST') {
      const body = await lerBody(req);
      if (!body.nome) return responder(res, 400, { erro: 'Nome é obrigatório' });
      const c = await clientesModule.criar(body);
      return responder(res, 201, c);
    }
    if (req.method === 'PUT' && id) {
      const body = await lerBody(req);
      const c = await clientesModule.atualizar(id, body);
      return c ? responder(res, 200, c) : responder(res, 404, { erro: 'Cliente não encontrado' });
    }
    if (req.method === 'DELETE' && id) {
      const ok = await clientesModule.deletar(id);
      return ok ? responder(res, 200, { mensagem: 'Cliente removido' }) : responder(res, 404, { erro: 'Cliente não encontrado' });
    }
    return responder(res, 405, { erro: 'Método não permitido' });
  }

  // ── CRUD Fornecedores — proxy para Python (porta 3001) ────────────────────

  if (recurso === 'fornecedores') {
    if (!sessao) return responder(res, 401, { erro: 'Não autenticado' });
    return proxyParaPython(req, res);
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
  .then(() => server.listen(3000, () => console.log('Servidor rodando em http://localhost:3000')))
  .catch(err => { console.error('Erro ao inicializar:', err.message); process.exit(1); });
