const carrinhoModule = require('../carrinho');
const estoqueModule  = require('../estoque');
const eventoModule   = require('../eventos');
const { parseCookies } = require('../middlewares/auth');

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

async function handle(req, res, sessao, partes, req_) {
  if (!sessao) return responder(res, 401, { erro: 'Não autenticado' });

  const clienteId = sessao.userId;

  if (req.method === 'GET' && !partes[1])
    return responder(res, 200, await carrinhoModule.obter(clienteId));

  if (req.method === 'POST' && partes[1] === 'itens') {
    const { produtoId, quantidade } = await lerBody(req);
    if (!produtoId) return responder(res, 400, { erro: 'produtoId é obrigatório' });
    const carrinho = await carrinhoModule.adicionarItem(clienteId, produtoId, quantidade || 1);
    dispararEvento({
      tipo:        eventoModule.TIPOS.ADICIONADO_CARRINHO,
      clienteId:   sessao.userId,
      clienteNome: sessao.nome,
      dados: { produtoId, quantidade: quantidade || 1 },
    });
    return responder(res, 200, carrinho);
  }

  if (req.method === 'PUT' && partes[1] === 'itens' && partes[2]) {
    const produtoId = parseInt(partes[2], 10);
    const { quantidade } = await lerBody(req);
    const carrinho = await carrinhoModule.adicionarItem(clienteId, produtoId, quantidade);
    return responder(res, 200, carrinho);
  }

  if (req.method === 'DELETE' && partes[1] === 'itens' && partes[2]) {
    const produtoId = parseInt(partes[2], 10);
    return responder(res, 200, await carrinhoModule.removerItem(clienteId, produtoId));
  }

  if (req.method === 'DELETE' && !partes[1]) {
    await carrinhoModule.limpar(clienteId);
    return responder(res, 200, { mensagem: 'Carrinho limpo' });
  }

  if (req.method === 'POST' && partes[1] === 'checkout') {
    dispararEvento({
      tipo:        eventoModule.TIPOS.CHECKOUT_INICIADO,
      clienteId:   sessao.userId,
      clienteNome: sessao.nome,
      dados:       { sessaoId: parseCookies(req_).sessao_id?.slice(0, 8) },
    });

    try {
      const resultado = await carrinhoModule.checkout(clienteId);
      const pedidoId  = `PED-${Date.now()}`;
      dispararEvento({
        tipo:        eventoModule.TIPOS.PEDIDO_CRIADO,
        clienteId:   sessao.userId,
        clienteNome: sessao.nome,
        dados: { pedidoId, total: resultado.total, itens: resultado.itens.length },
      });
      return responder(res, 200, { ...resultado, pedidoId });
    } catch (e) {
      dispararEvento({
        tipo:        eventoModule.TIPOS.PAGAMENTO_RECUSADO,
        clienteId:   sessao.userId,
        clienteNome: sessao.nome,
        dados: { motivo: e.message },
      });
      return responder(res, 409, { erro: e.message });
    }
  }

  return responder(res, 405, { erro: 'Método não permitido' });
}

module.exports = { handle };
