const estoqueModule = require('../estoque');
const eventoModule  = require('../eventos');
const redis         = require('../redis');

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

async function handle(req, res, sessao, partes, qs, limit, offset) {
  if (!sessao) return responder(res, 401, { erro: 'Não autenticado' });

  const produtoId = partes[1] ? parseInt(partes[1], 10) : null;

  if (req.method === 'GET' && !produtoId)       return responder(res, 200, await estoqueModule.listar(limit, offset));

  if (req.method === 'GET' && produtoId && !partes[2]) {
    const e = await estoqueModule.buscar(produtoId);
    return e ? responder(res, 200, e) : responder(res, 404, { erro: 'Estoque não encontrado' });
  }

  if (req.method === 'PUT' && produtoId && !partes[2]) {
    if (sessao.role !== 'Admin') return responder(res, 403, { erro: 'Acesso restrito a administradores' });
    const { quantidade } = await lerBody(req);
    if (quantidade === undefined || quantidade < 0) return responder(res, 400, { erro: 'Quantidade inválida' });
    const e = await estoqueModule.atualizar(produtoId, quantidade);
    return responder(res, 200, e);
  }

  if (req.method === 'POST' && produtoId && partes[2] === 'reservar') {
    const { quantidade } = await lerBody(req);
    if (!quantidade || quantidade <= 0) return responder(res, 400, { erro: 'Quantidade deve ser maior que zero' });
    try {
      const r = await estoqueModule.reservar(produtoId, quantidade);
      return responder(res, 200, r);
    } catch (e) {
      return responder(res, 409, { erro: e.message });
    }
  }

  if (req.method === 'DELETE' && produtoId && partes[2] === 'reserva') {
    const qtd = qs.has('quantidade') ? parseInt(qs.get('quantidade'), 10) : null;
    const novo = qtd ? await estoqueModule.liberarReserva(produtoId, qtd)
                     : (await redis.del(`reserva:${produtoId}`), 0);
    return responder(res, 200, { reservado: novo });
  }

  if (req.method === 'POST' && produtoId && partes[2] === 'confirmar') {
    if (sessao.role !== 'Admin') return responder(res, 403, { erro: 'Acesso restrito a administradores' });
    const { quantidade, pedidoId, valor } = await lerBody(req);
    if (!quantidade || quantidade <= 0) return responder(res, 400, { erro: 'Quantidade inválida' });
    await estoqueModule.confirmarVenda(produtoId, quantidade);
    dispararEvento({
      tipo:        eventoModule.TIPOS.PAGAMENTO_APROVADO,
      clienteId:   sessao.userId,
      clienteNome: sessao.nome,
      dados: { produtoId, quantidade, pedidoId: pedidoId || null, valor: valor || null },
    });
    return responder(res, 200, { mensagem: 'Venda confirmada, estoque debitado' });
  }

  return responder(res, 405, { erro: 'Método não permitido' });
}

module.exports = { handle };
