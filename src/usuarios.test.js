const assert = require('assert');
const { inicializar, criar, listar, buscar, atualizar, deletar } = require('./usuarios');
const { pool } = require('./db');

async function resetar() {
  await pool.query('TRUNCATE TABLE usuarios RESTART IDENTITY');
}

async function run() {
  await inicializar();

  // criar
  await resetar();
  const u1 = await criar('Ana', 'ana@email.com');
  assert.strictEqual(u1.id, 1, 'id deve ser 1');
  assert.strictEqual(u1.nome, 'Ana', 'nome deve ser Ana');
  assert.strictEqual(u1.email, 'ana@email.com', 'email deve ser ana@email.com');

  const u2 = await criar('Bruno', 'bruno@email.com');
  assert.strictEqual(u2.id, 2, 'id deve ser 2');

  // listar
  await resetar();
  await criar('Ana', 'ana@email.com');
  await criar('Bruno', 'bruno@email.com');
  const todos = await listar();
  assert.strictEqual(todos.length, 2, 'deve listar 2 usuários');

  // buscar
  await resetar();
  const criado = await criar('Carlos', 'carlos@email.com');
  const encontrado = await buscar(criado.id);
  assert.strictEqual(encontrado.nome, 'Carlos', 'deve encontrar Carlos');
  assert.strictEqual(await buscar(999), null, 'deve retornar null para id inexistente');

  // atualizar
  await resetar();
  const u = await criar('Diana', 'diana@email.com');
  const atualizado = await atualizar(u.id, { nome: 'Diana Silva' });
  assert.strictEqual(atualizado.nome, 'Diana Silva', 'nome deve ser atualizado');
  assert.strictEqual(atualizado.email, 'diana@email.com', 'email deve permanecer');
  assert.strictEqual(await atualizar(999, { nome: 'X' }), null, 'deve retornar null para id inexistente');

  // deletar
  await resetar();
  const ud = await criar('Eduardo', 'edu@email.com');
  assert.strictEqual(await deletar(ud.id), true, 'deve deletar e retornar true');
  assert.strictEqual(await buscar(ud.id), null, 'usuário deletado não deve ser encontrado');
  assert.strictEqual(await deletar(999), false, 'deve retornar false para id inexistente');

  console.log('Todos os testes de usuários passaram.');
  await pool.end();
}

run().catch(err => { console.error('Erro nos testes:', err.message); process.exit(1); });
