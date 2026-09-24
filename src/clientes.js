// ============================================================================
// clientes.js (model) — Camada de acesso a dados dos Clientes.
// Concentra todas as queries SQL da tabela `clientes`. Nenhuma outra parte
// do sistema fala direto com o banco: sempre passa por estas funções.
// Todas as queries são parametrizadas ($1, $2...) para evitar SQL injection.
// ============================================================================

const { pool } = require('./db');   // pool de conexões PostgreSQL (node-postgres)

// Colunas editáveis da tabela (exclui `id`, que é gerado pelo banco).
// Serve de fonte única para montar INSERTs e UPDATEs de forma consistente.
const CAMPOS = ['nome', 'endereco', 'bairro', 'cidade', 'estado', 'email', 'telefone'];

// Cria a tabela `clientes` caso ainda não exista (idempotente).
// Chamada na inicialização do servidor.
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

// Insere um novo cliente e retorna a linha criada (com o id gerado).
// Campos ausentes em `dados` viram NULL, na ordem definida em CAMPOS.
async function criar(dados) {
  const { rows } = await pool.query(
    'INSERT INTO clientes (nome, endereco, bairro, cidade, estado, email, telefone) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    CAMPOS.map(c => dados[c] || null)
  );
  return rows[0];
}

// Lista clientes ordenados por id.
// Com `limit` informado, aplica paginação (LIMIT/OFFSET); sem ele, retorna todos.
async function listar(limit = null, offset = 0) {
  if (limit !== null) {
    const { rows } = await pool.query('SELECT * FROM clientes ORDER BY id LIMIT $1 OFFSET $2', [limit, offset]);
    return rows;
  }
  const { rows } = await pool.query('SELECT * FROM clientes ORDER BY id');
  return rows;
}

// Busca um cliente pelo id. Retorna o objeto ou null se não existir.
async function buscar(id) {
  const { rows } = await pool.query('SELECT * FROM clientes WHERE id = $1', [id]);
  return rows[0] || null;
}

// Atualiza um cliente de forma PARCIAL: só altera os campos presentes em `dados`.
// Monta dinamicamente o SET apenas com os campos enviados.
async function atualizar(id, dados) {
  const campos = [];    // fragmentos "coluna = $n" do SET
  const valores = [];   // valores correspondentes (na mesma ordem)
  let i = 1;            // contador dos placeholders posicionais ($1, $2...)

  // Monta o SET apenas com os campos realmente fornecidos.
  for (const campo of CAMPOS) {
    if (dados[campo] !== undefined) {
      campos.push(`${campo} = $${i++}`);
      valores.push(dados[campo]);
    }
  }

  // Nada para atualizar: apenas devolve o registro atual.
  if (campos.length === 0) return buscar(id);

  valores.push(id);   // o id é o último placeholder ($i), usado no WHERE
  const { rows } = await pool.query(
    `UPDATE clientes SET ${campos.join(', ')} WHERE id = $${i} RETURNING *`,
    valores
  );
  return rows[0] || null;
}

// Remove um cliente pelo id. Retorna true se algo foi removido, false se não existia.
async function deletar(id) {
  const { rowCount } = await pool.query('DELETE FROM clientes WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = { inicializar, criar, listar, buscar, atualizar, deletar };
