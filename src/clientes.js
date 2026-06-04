const { pool } = require('./db');

const CAMPOS = ['nome', 'endereco', 'bairro', 'cidade', 'estado', 'email', 'telefone'];

async function inicializar() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clientes (
      id       SERIAL PRIMARY KEY,
      nome     TEXT NOT NULL,
      endereco TEXT,
      bairro   TEXT,
      cidade   TEXT,
      estado   TEXT,
      email    TEXT,
      telefone TEXT
    )
  `);
}

async function criar(dados) {
  const { rows } = await pool.query(
    'INSERT INTO clientes (nome, endereco, bairro, cidade, estado, email, telefone) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    CAMPOS.map(c => dados[c] || null)
  );
  return rows[0];
}

async function listar() {
  const { rows } = await pool.query('SELECT * FROM clientes ORDER BY id');
  return rows;
}

async function buscar(id) {
  const { rows } = await pool.query('SELECT * FROM clientes WHERE id = $1', [id]);
  return rows[0] || null;
}

async function atualizar(id, dados) {
  const campos = [];
  const valores = [];
  let i = 1;

  for (const campo of CAMPOS) {
    if (dados[campo] !== undefined) {
      campos.push(`${campo} = $${i++}`);
      valores.push(dados[campo]);
    }
  }

  if (campos.length === 0) return buscar(id);

  valores.push(id);
  const { rows } = await pool.query(
    `UPDATE clientes SET ${campos.join(', ')} WHERE id = $${i} RETURNING *`,
    valores
  );
  return rows[0] || null;
}

async function deletar(id) {
  const { rowCount } = await pool.query('DELETE FROM clientes WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = { inicializar, criar, listar, buscar, atualizar, deletar };
