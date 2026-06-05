const { pool, garantirBanco } = require('./db');
const crypto = require('crypto');

function hashSenha(senha) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(senha, salt, 64, (err, key) => {
      if (err) reject(err); else resolve(`${salt}:${key.toString('hex')}`);
    });
  });
}

function verificarSenha(senha, hash) {
  return new Promise((resolve, reject) => {
    const [salt, key] = (hash || '').split(':');
    if (!salt || !key) return resolve(false);
    crypto.scrypt(senha, salt, 64, (err, derivedKey) => {
      if (err) reject(err); else resolve(derivedKey.toString('hex') === key);
    });
  });
}

async function inicializar() {
  await garantirBanco();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id    SERIAL PRIMARY KEY,
      nome  TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      senha TEXT NOT NULL DEFAULT '',
      role  TEXT NOT NULL DEFAULT 'Atendente'
    )
  `);
  await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS senha TEXT NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS role  TEXT NOT NULL DEFAULT 'Atendente'`);
  await pool.query(`UPDATE usuarios SET role = 'Admin' WHERE id = 1 AND role != 'Admin'`);

  const { rows } = await pool.query('SELECT COUNT(*) FROM usuarios');
  if (parseInt(rows[0].count) === 0) {
    await criar('Admin', 'admin@labsystem.com', 'admin123', 'Admin');
    console.log('Usuário admin criado — email: admin@labsystem.com | senha: admin123');
  } else {
    // Migração: atualiza senha do admin se estiver vazia (usuários criados antes da versão com senha)
    const { rows: admin } = await pool.query(`SELECT senha FROM usuarios WHERE id = 1`);
    if (admin.length > 0 && !admin[0].senha.includes(':')) {
      const senhaHash = await hashSenha('admin123');
      await pool.query(`UPDATE usuarios SET senha = $1, role = 'Admin' WHERE id = 1`, [senhaHash]);
      console.log('Senha do admin migrada — email: admin@labsystem.com | senha: admin123');
    }
  }
}

async function criar(nome, email, senha, role = 'Atendente') {
  const senhaHash = await hashSenha(senha);
  const { rows } = await pool.query(
    'INSERT INTO usuarios (nome, email, senha, role) VALUES ($1, $2, $3, $4) RETURNING id, nome, email, role',
    [nome, email, senhaHash, role]
  );
  if (rows[0].id === 1) {
    await pool.query(`UPDATE usuarios SET role = 'Admin' WHERE id = 1`);
    rows[0].role = 'Admin';
  }
  return rows[0];
}

async function listar(limit = null, offset = 0) {
  if (limit !== null) {
    const { rows } = await pool.query('SELECT id, nome, email, role FROM usuarios ORDER BY id LIMIT $1 OFFSET $2', [limit, offset]);
    return rows;
  }
  const { rows } = await pool.query('SELECT id, nome, email, role FROM usuarios ORDER BY id');
  return rows;
}

async function buscar(id) {
  const { rows } = await pool.query('SELECT id, nome, email, role FROM usuarios WHERE id = $1', [id]);
  return rows[0] || null;
}

async function buscarPorEmail(email) {
  const { rows } = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
  return rows[0] || null;
}

async function atualizar(id, dados) {
  const campos = [];
  const valores = [];
  let i = 1;

  if (dados.nome  !== undefined) { campos.push(`nome = $${i++}`);  valores.push(dados.nome); }
  if (dados.email !== undefined) { campos.push(`email = $${i++}`); valores.push(dados.email); }
  if (dados.role  !== undefined) { campos.push(`role = $${i++}`);  valores.push(dados.role); }
  if (dados.senha) {
    const senhaHash = await hashSenha(dados.senha);
    campos.push(`senha = $${i++}`);
    valores.push(senhaHash);
  }

  if (campos.length === 0) return buscar(id);

  valores.push(id);
  const { rows } = await pool.query(
    `UPDATE usuarios SET ${campos.join(', ')} WHERE id = $${i} RETURNING id, nome, email, role`,
    valores
  );
  return rows[0] || null;
}

async function deletar(id) {
  const { rowCount } = await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = { inicializar, criar, listar, buscar, buscarPorEmail, atualizar, deletar, verificarSenha };
