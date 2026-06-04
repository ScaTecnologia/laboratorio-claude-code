const crypto = require('crypto');
const sessoes = new Map();

function criar(dados) {
  const id = crypto.randomBytes(32).toString('hex');
  sessoes.set(id, { ...dados });
  return id;
}

function buscar(id) {
  return id ? (sessoes.get(id) || null) : null;
}

function encerrar(id) {
  sessoes.delete(id);
}

module.exports = { criar, buscar, encerrar };
