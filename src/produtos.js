// Serviço de Produtos: CRUD no PostgreSQL + cache de leitura no Redis
const { pool } = require('./db');
const redis    = require('./redis');

const CACHE_TTL = 300; // 5 minutos — ajuste conforme a frequência de atualização

// ── Inicialização ─────────────────────────────────────────────────────────────

async function inicializar() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS categorias (
      id        SERIAL PRIMARY KEY,
      nome      TEXT NOT NULL UNIQUE,
      descricao TEXT
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS produtos (
      id           SERIAL PRIMARY KEY,
      nome         TEXT NOT NULL,
      descricao    TEXT,
      preco        NUMERIC(10,2) NOT NULL DEFAULT 0,
      categoria_id INTEGER REFERENCES categorias(id),
      ativo        BOOLEAN NOT NULL DEFAULT true
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS estoque (
      produto_id INTEGER PRIMARY KEY REFERENCES produtos(id) ON DELETE CASCADE,
      quantidade INTEGER NOT NULL DEFAULT 0
    )
  `);

  const { rows } = await pool.query('SELECT COUNT(*) FROM categorias');
  if (parseInt(rows[0].count) === 0) {
    await pool.query(`
      INSERT INTO categorias (nome) VALUES
        ('Eletrônicos'), ('Roupas'), ('Casa e Decoração'), ('Alimentos'), ('Esportes')
    `);
    console.log('[Produtos] Categorias iniciais criadas.');
  }
}

// ── Helpers de cache ──────────────────────────────────────────────────────────

// Deleta as chaves de cache afetadas por uma mudança no produto
async function invalidarCache(id = null) {
  // Apaga todas as variações de cache da lista (sem paginação e com paginação)
  const listaKeys = await redis.keys('cache:produtos:lista*');
  if (listaKeys.length) await redis.del(...listaKeys);
  if (id) await redis.del(`cache:produto:${id}`);
}

// ── Leitura com cache ─────────────────────────────────────────────────────────

// Retorna { origem, ttl, dados, total }
// Sem limit: retorna todos os produtos (chave de cache sem sufixo)
// Com limit: retorna a página solicitada (chave por página, com total real via COUNT OVER)
async function listar(limit = null, offset = 0) {
  const cacheKey = limit !== null
    ? `cache:produtos:lista:${limit}:${offset}`
    : 'cache:produtos:lista';

  // 1. Verifica o cache Redis (leitura rápida ~1ms)
  const cached = await redis.get(cacheKey);
  if (cached) {
    const ttl = await redis.ttl(cacheKey);
    return { origem: 'redis', ttl, ...JSON.parse(cached) };
  }

  // 2. Cache miss — busca no PostgreSQL
  let rows, total;

  if (limit !== null) {
    // Paginado: COUNT(*) OVER() retorna o total sem segundo round-trip
    const { rows: r } = await pool.query(`
      SELECT p.id, p.nome, p.descricao, p.preco, p.ativo,
             p.categoria_id, c.nome AS categoria,
             COALESCE(e.quantidade, 0) AS estoque,
             COUNT(*) OVER() AS total_count
      FROM   produtos p
      LEFT JOIN categorias c ON c.id = p.categoria_id
      LEFT JOIN estoque    e ON e.produto_id = p.id
      ORDER  BY p.id
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    total = r.length > 0 ? parseInt(r[0].total_count, 10) : 0;
    rows  = r.map(({ total_count, ...rest }) => rest);
  } else {
    // Sem paginação: retorna todos
    const { rows: r } = await pool.query(`
      SELECT p.id, p.nome, p.descricao, p.preco, p.ativo,
             p.categoria_id, c.nome AS categoria,
             COALESCE(e.quantidade, 0) AS estoque
      FROM   produtos p
      LEFT JOIN categorias c ON c.id = p.categoria_id
      LEFT JOIN estoque    e ON e.produto_id = p.id
      ORDER  BY p.id
    `);
    total = r.length;
    rows  = r;
  }

  // 3. Armazena no Redis com TTL antes de retornar
  const payload = { dados: rows, total };
  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(payload));

  return { origem: 'banco', ttl: CACHE_TTL, ...payload };
}

async function buscar(id) {
  // 1. Verifica o cache Redis para este produto específico
  const cached = await redis.get(`cache:produto:${id}`);
  if (cached) {
    const ttl = await redis.ttl(`cache:produto:${id}`);
    return { origem: 'redis', ttl, dados: JSON.parse(cached) };
  }

  // 2. Cache miss — busca no PostgreSQL
  const { rows } = await pool.query(`
    SELECT p.id, p.nome, p.descricao, p.preco, p.ativo,
           p.categoria_id, c.nome AS categoria,
           COALESCE(e.quantidade, 0) AS estoque
    FROM   produtos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    LEFT JOIN estoque    e ON e.produto_id = p.id
    WHERE  p.id = $1
  `, [id]);

  if (!rows[0]) return { origem: 'banco', ttl: null, dados: null };

  // 3. Armazena no Redis antes de retornar
  await redis.setex(`cache:produto:${id}`, CACHE_TTL, JSON.stringify(rows[0]));

  return { origem: 'banco', ttl: CACHE_TTL, dados: rows[0] };
}

// ── Escrita — sempre invalida o cache depois ───────────────────────────────────

async function criar(dados) {
  const { nome, descricao, preco, categoria_id, quantidade = 0 } = dados;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO produtos (nome, descricao, preco, categoria_id)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [nome, descricao || null, preco, categoria_id || null]
    );
    const produto = rows[0];
    await client.query(
      'INSERT INTO estoque (produto_id, quantidade) VALUES ($1,$2)',
      [produto.id, quantidade]
    );
    await client.query('COMMIT');

    // Invalida o cache da lista (novo produto adicionado)
    await invalidarCache();

    return produto;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function atualizar(id, dados) {
  const campos = [];
  const valores = [];
  let i = 1;

  if (dados.nome         !== undefined) { campos.push(`nome = $${i++}`);         valores.push(dados.nome); }
  if (dados.descricao    !== undefined) { campos.push(`descricao = $${i++}`);    valores.push(dados.descricao); }
  if (dados.preco        !== undefined) { campos.push(`preco = $${i++}`);        valores.push(dados.preco); }
  if (dados.categoria_id !== undefined) { campos.push(`categoria_id = $${i++}`); valores.push(dados.categoria_id); }
  if (dados.ativo        !== undefined) { campos.push(`ativo = $${i++}`);        valores.push(dados.ativo); }

  if (campos.length === 0) return (await buscar(id)).dados;

  valores.push(id);
  const { rows } = await pool.query(
    `UPDATE produtos SET ${campos.join(', ')} WHERE id = $${i} RETURNING *`,
    valores
  );
  if (!rows[0]) return null;

  // Invalida cache do produto específico E da lista
  await invalidarCache(id);

  return rows[0];
}

async function deletar(id) {
  const { rowCount } = await pool.query('DELETE FROM produtos WHERE id = $1', [id]);
  if (rowCount > 0) await invalidarCache(id);
  return rowCount > 0;
}

async function listarCategorias() {
  const { rows } = await pool.query('SELECT * FROM categorias ORDER BY nome');
  return rows;
}

module.exports = { inicializar, listar, buscar, criar, atualizar, deletar, listarCategorias, invalidarCache, CACHE_TTL };
