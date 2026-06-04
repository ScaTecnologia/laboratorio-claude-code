const assert = require('assert');
const { soma } = require('./soma');

assert.strictEqual(soma(2, 3), 5, '2 + 3 deve ser 5');
assert.strictEqual(soma(-1, 1), 0, '-1 + 1 deve ser 0');
assert.strictEqual(soma(0, 0), 0, '0 + 0 deve ser 0');

console.log('Todos os testes passaram.');
