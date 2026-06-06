const produtosModule = require('../produtos');
const eventoModule   = require('../eventos');

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

function dispararEvento(dados) {
  eventoModule.registrar(dados).catch(e => console.error('[MongoDB] Erro ao registrar evento:', e.message));
}

async function handle(req, res, sessao, partes, limit, offset) {
  const id = partes[1] ? Number(partes[1]) : null;

  if (req.method === 'DELETE' && partes[1] === 'cache') {
    if (!sessao)                 return responder(res, 401, { erro: 'Não autenticado' });
    if (sessao.role !== 'Admin') return responder(res, 403, { erro: 'Acesso restrito a administradores' });
    await produtosModule.invalidarCache();
    return responder(res, 200, { mensagem: 'Cache de produtos invalidado' });
  }

  if (req.method === 'GET' && !id) {
    const resultado = await produtosModule.listar(limit, offset);
    res.setHeader('X-Cache',     resultado.origem === 'redis' ? 'HIT' : 'MISS');
    res.setHeader('X-Cache-TTL', String(resultado.ttl || 0));
    return responder(res, 200, resultado);
  }

  if (req.method === 'GET' && id) {
    const resultado = await produtosModule.buscar(id);
    if (!resultado.dados) return responder(res, 404, { erro: 'Produto não encontrado' });
    res.setHeader('X-Cache',     resultado.origem === 'redis' ? 'HIT' : 'MISS');
    res.setHeader('X-Cache-TTL', String(resultado.ttl || 0));

    if (sessao) {
      dispararEvento({
        tipo:        eventoModule.TIPOS.PRODUTO_VISUALIZADO,
        clienteId:   sessao.userId,
        clienteNome: sessao.nome,
        dados: { produtoId: id, produtoNome: resultado.dados.nome, preco: resultado.dados.preco },
      });
    }

    return responder(res, 200, resultado);
  }

  if (req.method === 'POST') {
    if (!sessao)                 return responder(res, 401, { erro: 'Não autenticado' });
    if (sessao.role !== 'Admin') return responder(res, 403, { erro: 'Acesso restrito a administradores' });
    const body = await lerBody(req);
    if (!body.nome)              return responder(res, 400, { erro: 'Nome é obrigatório' });
    if (body.preco === undefined) return responder(res, 400, { erro: 'Preço é obrigatório' });
    const p = await produtosModule.criar(body);
    return responder(res, 201, p);
  }

  if (req.method === 'PUT' && id) {
    if (!sessao)                 return responder(res, 401, { erro: 'Não autenticado' });
    if (sessao.role !== 'Admin') return responder(res, 403, { erro: 'Acesso restrito a administradores' });
    const body = await lerBody(req);
    const p = await produtosModule.atualizar(id, body);
    return p ? responder(res, 200, p) : responder(res, 404, { erro: 'Produto não encontrado' });
  }

  if (req.method === 'DELETE' && id) {
    if (!sessao)                 return responder(res, 401, { erro: 'Não autenticado' });
    if (sessao.role !== 'Admin') return responder(res, 403, { erro: 'Acesso restrito a administradores' });
    const ok = await produtosModule.deletar(id);
    return ok ? responder(res, 200, { mensagem: 'Produto removido' }) : responder(res, 404, { erro: 'Produto não encontrado' });
  }

  return responder(res, 405, { erro: 'Método não permitido' });
}

module.exports = { handle };
