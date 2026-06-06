const avaliacoesModule = require('../avaliacoes');
const { pool }         = require('../db');

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

async function handle(req, res, sessao, partes, qs) {
  if (!sessao) return responder(res, 401, { erro: 'Não autenticado' });

  const sub  = partes[1];
  const sub2 = partes[2];
  const sub3 = partes[3];

  if (req.method === 'POST' && !sub) {
    const body = await lerBody(req);
    if (!body.clienteId) body.clienteId = sessao.userId;
    try {
      const av = await avaliacoesModule.criar(body);
      return responder(res, 201, av);
    } catch (e) {
      return responder(res, 400, { erro: e.message });
    }
  }

  if (req.method === 'GET' && !sub) {
    const filtros = {
      limit:     qs.has('limit')     ? parseInt(qs.get('limit'),     10) : 20,
      offset:    qs.has('offset')    ? parseInt(qs.get('offset'),    10) : 0,
      status:    qs.get('status')    || null,
      produtoId: qs.get('produtoId') || null,
      clienteId: qs.get('clienteId') || null,
      nota:      qs.get('nota')      || null,
    };
    return responder(res, 200, await avaliacoesModule.listar(filtros));
  }

  if (req.method === 'GET' && sub === 'produto' && sub2 && sub3 === 'media')
    return responder(res, 200, await avaliacoesModule.media(sub2));

  if (req.method === 'GET' && sub === 'produto' && sub2 && !sub3) {
    const filtros = {
      status:  qs.get('status') || null,
      limit:   qs.has('limit')  ? parseInt(qs.get('limit'),  10) : 20,
      offset:  qs.has('offset') ? parseInt(qs.get('offset'), 10) : 0,
    };
    return responder(res, 200, await avaliacoesModule.porProduto(sub2, filtros));
  }

  if (req.method === 'GET' && sub === 'cliente' && sub2)
    return responder(res, 200, await avaliacoesModule.porCliente(sub2));

  const isObjectId = sub && sub !== 'produto' && sub !== 'cliente' && sub !== 'seed';

  if (req.method === 'GET' && isObjectId) {
    const av = await avaliacoesModule.buscarPorId(sub);
    return av ? responder(res, 200, av) : responder(res, 404, { erro: 'Avaliação não encontrada' });
  }

  if (req.method === 'PUT' && isObjectId) {
    const body = await lerBody(req);
    if (body.status && sessao.role !== 'Admin')
      return responder(res, 403, { erro: 'Somente Admin pode alterar o status da avaliação' });
    try {
      const av = await avaliacoesModule.atualizar(sub, body);
      return av ? responder(res, 200, av) : responder(res, 404, { erro: 'Avaliação não encontrada' });
    } catch (e) {
      return responder(res, 400, { erro: e.message });
    }
  }

  if (req.method === 'DELETE' && isObjectId) {
    if (sessao.role !== 'Admin') return responder(res, 403, { erro: 'Somente Admin pode excluir avaliações' });
    const ok = await avaliacoesModule.excluir(sub);
    return ok ? responder(res, 200, { mensagem: 'Avaliação excluída' }) : responder(res, 404, { erro: 'Avaliação não encontrada' });
  }

  if (req.method === 'POST' && sub === 'seed') {
    const { rows: produtos } = await pool.query('SELECT id FROM produtos LIMIT 2');
    const ids = produtos.map(p => p.id);
    const r   = await avaliacoesModule.semearDados(ids.length >= 2 ? ids : [1, 2]);
    return responder(res, 200, r);
  }

  return responder(res, 405, { erro: 'Método não permitido' });
}

module.exports = { handle };
