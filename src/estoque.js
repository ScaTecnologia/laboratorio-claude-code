// Serviço de Estoque: quantidades no PostgreSQL + reservas temporárias no Redis
// As reservas expiram automaticamente — se o checkout não completar, o estoque volta a ficar disponível
const { pool }      = require('./db');
const redis         = require('./redis');
const produtosModule = require('./produtos');

const RESERVA_TTL = 600; // 10 minutos para completar o pagamento

// ── Leitura ───────────────────────────────────────────────────────────────────

async function buscar(produtoId) {
  const { rows } = await pool.query(
    'SELECT produto_id, quantidade FROM estoque WHERE produto_id = $1',
    [produtoId]
  );
  if (!rows[0]) return null;

  // Reservas ficam no Redis — busca quantidade reservada e TTL restante
  const reservado   = parseInt(await redis.get(`reserva:${produtoId}`) || '0', 10);
  const ttlReserva  = await redis.ttl(`reserva:${produtoId}`);

  return {
    produto_id: rows[0].produto_id,
    quantidade:  rows[0].quantidade,
    reservado,
    disponivel:  rows[0].quantidade - reservado,
    reserva_ttl: ttlReserva > 0 ? ttlReserva : null,
  };
}

async function listar() {
  const { rows } = await pool.query(`
    SELECT e.produto_id, p.nome, e.quantidade
    FROM   estoque e
    JOIN   produtos p ON p.id = e.produto_id
    ORDER  BY p.nome
  `);

  // Enriquece cada linha com dados de reserva vindos do Redis
  return Promise.all(rows.map(async r => {
    const reservado  = parseInt(await redis.get(`reserva:${r.produto_id}`) || '0', 10);
    const ttlReserva = await redis.ttl(`reserva:${r.produto_id}`);
    return {
      ...r,
      reservado,
      disponivel:  r.quantidade - reservado,
      reserva_ttl: ttlReserva > 0 ? ttlReserva : null,
    };
  }));
}

// ── Escrita no banco ───────────────────────────────────────────────────────────

async function atualizar(produtoId, quantidade) {
  const { rows } = await pool.query(`
    INSERT INTO estoque (produto_id, quantidade)
    VALUES ($1, $2)
    ON CONFLICT (produto_id) DO UPDATE SET quantidade = $2
    RETURNING *
  `, [produtoId, quantidade]);

  // Invalida cache do produto (estoque mudou)
  await produtosModule.invalidarCache(produtoId);

  return rows[0];
}

// ── Reservas no Redis (para checkout) ─────────────────────────────────────────

async function reservar(produtoId, quantidade) {
  // Busca o estoque real no banco antes de reservar
  const { rows } = await pool.query(
    'SELECT quantidade FROM estoque WHERE produto_id = $1',
    [produtoId]
  );
  if (!rows[0]) throw new Error('Produto sem estoque cadastrado');

  const estoqueTotal = rows[0].quantidade;

  // Script Lua garante atomicidade: verificar disponibilidade + incrementar
  // é uma operação indivisível — evita overselling em alta concorrência
  const script = `
    local atual  = tonumber(redis.call('GET', KEYS[1]) or '0')
    local total  = tonumber(ARGV[1])
    local pedir  = tonumber(ARGV[2])
    local ttl    = tonumber(ARGV[3])
    if atual + pedir > total then
      return -1
    end
    local novo = redis.call('INCRBY', KEYS[1], pedir)
    redis.call('EXPIRE', KEYS[1], ttl)
    return novo
  `;

  const resultado = await redis.eval(
    script, 1,
    `reserva:${produtoId}`,
    estoqueTotal, quantidade, RESERVA_TTL
  );

  if (resultado === -1) {
    const reservadoAtual = parseInt(await redis.get(`reserva:${produtoId}`) || '0', 10);
    throw new Error(`Estoque insuficiente. Disponível: ${estoqueTotal - reservadoAtual} unidade(s)`);
  }

  return { totalReservado: resultado, estoqueTotal, ttl: RESERVA_TTL };
}

async function liberarReserva(produtoId, quantidade) {
  const atual = parseInt(await redis.get(`reserva:${produtoId}`) || '0', 10);
  const novo  = Math.max(0, atual - quantidade);
  if (novo === 0) {
    await redis.del(`reserva:${produtoId}`);
  } else {
    await redis.set(`reserva:${produtoId}`, novo);
  }
  return novo;
}

// Confirma a venda: debita do banco e remove a reserva Redis
async function confirmarVenda(produtoId, quantidade) {
  await pool.query(
    'UPDATE estoque SET quantidade = quantidade - $1 WHERE produto_id = $2',
    [quantidade, produtoId]
  );
  await liberarReserva(produtoId, quantidade);
  await produtosModule.invalidarCache(produtoId);
}

module.exports = { buscar, listar, atualizar, reservar, liberarReserva, confirmarVenda, RESERVA_TTL };
