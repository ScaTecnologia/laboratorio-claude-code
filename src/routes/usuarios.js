const usuariosModule = require('../usuarios');

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

async function handle(req, res, sessao, id, limit, offset) {
  if (!sessao)                 return responder(res, 401, { erro: 'Não autenticado' });
  if (sessao.role !== 'Admin') return responder(res, 403, { erro: 'Acesso restrito a administradores' });

  if (req.method === 'GET' && !id)  return responder(res, 200, await usuariosModule.listar(limit, offset));

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

module.exports = { handle };
