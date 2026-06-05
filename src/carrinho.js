// Carrinho de compras 100% Redis — sem banco de dados
// Usa um Hash Redis por usuário: HSET carrinho:{userId} {produtoId} {quantidade}
// TTL de 30 minutos, renovado a cada interação
const redis         = require('./redis');
const { pool }      = require('./db');
const estoqueModule = require('./estoque');

const CARRINHO_TTL = 1800; // 30 minutos

function chave(clienteId) {
  return `carrinho:${clienteId}`;
}

// ── Leitura ───────────────────────────────────────────────────────────────────

async function obter(clienteId) {
  // HGETALL retorna {produtoId: 'quantidade', ...} ou null
  const itens = await redis.hgetall(chave(clienteId)) || {};
  const ttl   = await redis.ttl(chave(clienteId));

  if (Object.keys(itens).length === 0) {
    return { itens: [], total: 0, ttl: null };
  }

  // Enriquece com nome e preço buscando no PostgreSQL
  const ids = Object.keys(itens);
  const { rows } = await pool.query(
    'SELECT id, nome, preco FROM produtos WHERE id = ANY($1::int[])',
    [ids]
  );
  const mapa = Object.fromEntries(rows.map(p => [String(p.id), p]));

  let total = 0;
  const lista = ids.map(id => {
    const qtd    = parseInt(itens[id], 10);
    const prod   = mapa[id] || { nome: 'Produto removido', preco: 0 };
    const subtotal = parseFloat(prod.preco) * qtd;
    total += subtotal;
    return {
      produto_id: parseInt(id, 10),
      nome:       prod.nome,
      preco:      parseFloat(prod.preco),
      quantidade: qtd,
      subtotal:   parseFloat(subtotal.toFixed(2)),
    };
  });

  return {
    itens: lista,
    total: parseFloat(total.toFixed(2)),
    ttl:   ttl > 0 ? ttl : null,
  };
}

// ── Escrita ───────────────────────────────────────────────────────────────────

async function adicionarItem(clienteId, produtoId, quantidade) {
  if (quantidade <= 0) return removerItem(clienteId, produtoId);

  // HSET define a quantidade para este produto no hash do carrinho
  await redis.hset(chave(clienteId), String(produtoId), String(quantidade));
  // Renova o TTL a cada interação (carrinho ativo = mais 30 min)
  await redis.expire(chave(clienteId), CARRINHO_TTL);

  return obter(clienteId);
}

async function removerItem(clienteId, produtoId) {
  await redis.hdel(chave(clienteId), String(produtoId));
  return obter(clienteId);
}

async function limpar(clienteId) {
  await redis.del(chave(clienteId));
}

// ── Checkout ──────────────────────────────────────────────────────────────────

async function checkout(clienteId) {
  const carrinho = await obter(clienteId);
  if (carrinho.itens.length === 0) throw new Error('Carrinho vazio');

  const reservasFeitas = []; // registra o que foi reservado para rollback

  try {
    // Reserva estoque para cada item no carrinho
    for (const item of carrinho.itens) {
      await estoqueModule.reservar(item.produto_id, item.quantidade);
      reservasFeitas.push({ produto_id: item.produto_id, quantidade: item.quantidade });
    }

    // Carrinho limpo após reserva bem-sucedida
    await limpar(clienteId);

    return {
      sucesso:  true,
      itens:    carrinho.itens,
      total:    carrinho.total,
      reservas: reservasFeitas,
      ttl:      estoqueModule.RESERVA_TTL,
      mensagem: `${reservasFeitas.length} item(ns) reservado(s). Você tem ${estoqueModule.RESERVA_TTL / 60} minutos para concluir o pagamento.`,
    };
  } catch (e) {
    // Rollback: libera todas as reservas feitas antes do erro
    for (const r of reservasFeitas) {
      await estoqueModule.liberarReserva(r.produto_id, r.quantidade).catch(() => {});
    }
    throw e;
  }
}

module.exports = { obter, adicionarItem, removerItem, limpar, checkout, CARRINHO_TTL };
