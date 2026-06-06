const eventoModule = require('../eventos');

function responder(res, status, dados) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(dados));
}

async function handle(req, res, sessao, partes, qs) {
  if (!sessao) return responder(res, 401, { erro: 'Não autenticado' });

  const sub   = partes[1];
  const subId = partes[2];

  if (req.method === 'GET' && !sub) {
    const tipo      = qs.get('tipo')      || null;
    const cId       = qs.get('clienteId') || null;
    const lim       = qs.has('limit')  ? parseInt(qs.get('limit'),  10) : 50;
    const off       = qs.has('offset') ? parseInt(qs.get('offset'), 10) : 0;
    return responder(res, 200, await eventoModule.todos({ limit: lim, offset: off, tipo, clienteId: cId }));
  }

  if (req.method === 'GET' && sub === 'cliente' && subId)
    return responder(res, 200, await eventoModule.porCliente(subId));

  if (req.method === 'GET' && sub === 'pedido' && subId)
    return responder(res, 200, await eventoModule.porPedido(subId));

  if (req.method === 'POST' && sub === 'seed') {
    const resultado = await eventoModule.semearDados();
    return responder(res, 200, resultado);
  }

  if (req.method === 'DELETE' && !sub) {
    if (sessao.role !== 'Admin') return responder(res, 403, { erro: 'Acesso restrito a administradores' });
    const r = await eventoModule.limpar();
    return responder(res, 200, { deletados: r.deletedCount });
  }

  return responder(res, 405, { erro: 'Método não permitido' });
}

module.exports = { handle };
