const crypto = require('crypto');
const { pool } = require('./db');

async function inicializar() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessoes (
      id        TEXT PRIMARY KEY,
      dados     TEXT NOT NULL,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`DELETE FROM sessoes WHERE criado_em < NOW() - INTERVAL '7 days'`);
}

async function criar(dados) {
  const id = crypto.randomBytes(32).toString('hex');
  await pool.query('INSERT INTO sessoes (id, dados) VALUES ($1, $2)', [id, JSON.stringify(dados)]);
  return id;
}

async function buscar(id) {
  if (!id) return null;
  const { rows } = await pool.query(
    `SELECT dados FROM sessoes WHERE id = $1 AND criado_em > NOW() - INTERVAL '7 days'`,
    [id]
  );
  return rows[0] ? JSON.parse(rows[0].dados) : null;
}

async function encerrar(id) {
  await pool.query('DELETE FROM sessoes WHERE id = $1', [id]);
}

module.exports = { inicializar, criar, buscar, encerrar };
