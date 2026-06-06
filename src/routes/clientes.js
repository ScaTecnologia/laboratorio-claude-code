const clientesModule = require('../clientes');

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
  if (!sessao) return responder(res, 401, { erro: 'Não autenticado' });

  if (req.method === 'GET' && !id)  return responder(res, 200, await clientesModule.listar(limit, offset));

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

module.exports = { handle };
