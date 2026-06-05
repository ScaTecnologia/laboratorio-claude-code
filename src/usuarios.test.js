const assert = require('assert');
const { inicializar, criar, listar, buscar, atualizar, deletar, verificarSenha } = require('./usuarios');
const { pool } = require('./db');

async function resetar() {
  await pool.query('TRUNCATE TABLE usuarios RESTART IDENTITY');
}

async function run() {
  await inicializar();

  // ── criar ──────────────────────────────────────────────────────────────────
  await resetar();
  const u1 = await criar('Ana', 'ana@email.com', 'senha123', 'Atendente');
  assert.strictEqual(u1.id, 1, 'id deve ser 1');
  assert.strictEqual(u1.nome, 'Ana');
  assert.strictEqual(u1.email, 'ana@email.com');
  assert.strictEqual(u1.role, 'Admin', 'primeiro usuário (id=1) deve ser promovido a Admin');
  assert.ok(!('senha' in u1), 'criar não deve retornar campo senha');

  const u2 = await criar('Bruno', 'bruno@email.com', 'abc456', 'Atendente');
  assert.strictEqual(u2.id, 2);
  assert.strictEqual(u2.role, 'Atendente');
  assert.ok(!('senha' in u2), 'criar não deve retornar campo senha');

  // ── verificarSenha ─────────────────────────────────────────────────────────
  const { rows: [{ senha: hashU2 }] } = await pool.query('SELECT senha FROM usuarios WHERE id = $1', [u2.id]);
  assert.strictEqual(await verificarSenha('abc456', hashU2), true,  'senha correta deve retornar true');
  assert.strictEqual(await verificarSenha('errada', hashU2), false, 'senha errada deve retornar false');

  // ── listar — sem campo senha ───────────────────────────────────────────────
  const todos = await listar();
  assert.strictEqual(todos.length, 2, 'deve listar 2 usuários');
  todos.forEach(u => assert.ok(!('senha' in u), 'listar não deve retornar campo senha'));

  // ── buscar — sem campo senha ───────────────────────────────────────────────
  const encontrado = await buscar(u1.id);
  assert.strictEqual(encontrado.nome, 'Ana');
  assert.ok(!('senha' in encontrado), 'buscar não deve retornar campo senha');
  assert.strictEqual(await buscar(999), null, 'id inexistente deve retornar null');

  // ── atualizar nome ─────────────────────────────────────────────────────────
  await resetar();
  const ud = await criar('Diana', 'diana@email.com', 'diana123', 'Atendente');
  const atualizado = await atualizar(ud.id, { nome: 'Diana Silva' });
  assert.strictEqual(atualizado.nome, 'Diana Silva', 'nome deve ser atualizado');
  assert.strictEqual(atualizado.email, 'diana@email.com', 'email deve permanecer inalterado');
  assert.ok(!('senha' in atualizado), 'atualizar não deve retornar campo senha');
  assert.strictEqual(await atualizar(999, { nome: 'X' }), null, 'id inexistente deve retornar null');

  // ── atualizar senha ────────────────────────────────────────────────────────
  const { rows: [{ senha: hashOriginal }] } = await pool.query('SELECT senha FROM usuarios WHERE id = $1', [ud.id]);
  assert.strictEqual(await verificarSenha('diana123', hashOriginal), true, 'senha original deve permanecer válida antes de alterar');
  await atualizar(ud.id, { senha: 'nova456' });
  const { rows: [{ senha: hashNovo }] } = await pool.query('SELECT senha FROM usuarios WHERE id = $1', [ud.id]);
  assert.strictEqual(await verificarSenha('nova456',  hashNovo), true,  'nova senha deve verificar como true');
  assert.strictEqual(await verificarSenha('diana123', hashNovo), false, 'senha antiga não deve funcionar após troca');

  // ── atualizar role ─────────────────────────────────────────────────────────
  const uRole = await criar('Eve', 'eve@email.com', 'eve123', 'Visitante');
  const comNovaRole = await atualizar(uRole.id, { role: 'Atendente' });
  assert.strictEqual(comNovaRole.role, 'Atendente', 'role deve ser atualizada');

  // ── deletar ────────────────────────────────────────────────────────────────
  await resetar();
  await criar('Eduardo', 'edu@email.com', 'edu123', 'Atendente');
  const ud2 = await criar('Fernanda', 'fer@email.com', 'fer123', 'Atendente');
  assert.strictEqual(await deletar(ud2.id), true,  'deve deletar e retornar true');
  assert.strictEqual(await buscar(ud2.id),  null,  'usuário deletado não deve ser encontrado');
  assert.strictEqual(await deletar(999),    false, 'id inexistente deve retornar false');

  console.log('Todos os testes de usuários passaram.');
  await pool.end();
}

run().catch(err => { console.error('Erro nos testes:', err.message); process.exit(1); });
