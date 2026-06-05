// Serviço de Avaliações de Produtos — CRUD completo no MongoDB.
//
// Fluxo:
//   Produto existe no PostgreSQL (produtos.id)
//   Avaliação salva no MongoDB, referencia produtoId por convenção
//   Status inicial: "pendente" → Admin aprova/rejeita
const { getDb }                                   = require('./mongo');
const { validar, construir, construirUpdate }      = require('./models/avaliacao');

function col() { return getDb().collection('avaliacoes'); }

// ── Criar ─────────────────────────────────────────────────────────────────────

async function criar(dados) {
  const erros = validar(dados);
  if (erros.length > 0) throw new Error(erros.join('; '));

  const doc = construir(dados);
  const { insertedId } = await col().insertOne(doc);
  // Retorna o documento com _id serializado como string
  return { _id: insertedId, ...doc };
}

// ── Listar ────────────────────────────────────────────────────────────────────

async function listar({ limit = 20, offset = 0, status = null, produtoId = null,
                         clienteId = null, nota = null } = {}) {
  const query = {};
  if (status)    query.status    = status;
  if (produtoId) query.produtoId = parseInt(produtoId, 10);
  if (clienteId) query.clienteId = parseInt(clienteId, 10);
  if (nota)      query.nota      = parseInt(nota, 10);

  const docs  = await col().find(query).sort({ dataCriacao: -1 }).skip(offset).limit(limit).toArray();
  const total = await col().countDocuments(query);
  return { avaliacoes: docs, total };
}

// ── Buscar por ObjectId ───────────────────────────────────────────────────────

async function buscarPorId(id) {
  // id é uma string hexadecimal (ObjectId.toString())
  // O mock MongoDB compara String(doc._id) === id, o que funciona corretamente
  return col().findOne({ _id: id });
}

// ── Por produto ───────────────────────────────────────────────────────────────

async function porProduto(produtoId, { status = null, limit = 20, offset = 0 } = {}) {
  const query = { produtoId: parseInt(produtoId, 10) };
  if (status) query.status = status;

  const docs  = await col().find(query).sort({ dataCriacao: -1 }).skip(offset).limit(limit).toArray();
  const total = await col().countDocuments(query);
  return { avaliacoes: docs, total };
}

// ── Por cliente ───────────────────────────────────────────────────────────────

async function porCliente(clienteId, { limit = 20, offset = 0 } = {}) {
  const cId   = parseInt(clienteId, 10);
  const docs  = await col().find({ clienteId: cId }).sort({ dataCriacao: -1 }).skip(offset).limit(limit).toArray();
  const total = await col().countDocuments({ clienteId: cId });
  return { avaliacoes: docs, total };
}

// ── Atualizar ─────────────────────────────────────────────────────────────────

async function atualizar(id, dados) {
  const erros = validar(dados, true); // validação parcial
  if (erros.length > 0) throw new Error(erros.join('; '));

  const update = construirUpdate(dados);
  const r = await col().updateOne({ _id: id }, { $set: update });

  if (r.matchedCount === 0) return null;
  return buscarPorId(id);
}

// ── Excluir ───────────────────────────────────────────────────────────────────

async function excluir(id) {
  const r = await col().deleteOne({ _id: id });
  return r.deletedCount > 0;
}

// ── Média e distribuição por produto ─────────────────────────────────────────

async function media(produtoId) {
  const pId = parseInt(produtoId, 10);

  // Conta apenas avaliações aprovadas para calcular a nota pública
  const aprovadas = await col().find({ produtoId: pId, status: 'aprovado' }).toArray();

  // Distribuição por nota (1 a 5)
  const distribuicao = [1, 2, 3, 4, 5].map(n => ({
    nota:  n,
    count: aprovadas.filter(a => a.nota === n).length,
  }));

  if (aprovadas.length === 0) {
    return { produtoId: pId, total: 0, media: null, distribuicao };
  }

  const soma = aprovadas.reduce((acc, a) => acc + a.nota, 0);
  return {
    produtoId:    pId,
    total:        aprovadas.length,
    media:        parseFloat((soma / aprovadas.length).toFixed(1)),
    distribuicao,
  };
}

// ── Seed para testes ───────────────────────────────────────────────────────────

async function semearDados(produtoIds = [1, 2]) {
  const avaliacoes = [
    { produtoId: produtoIds[0] || 1, clienteId: 1, nota: 5,
      titulo: 'Produto incrível!', comentario: 'Superou minhas expectativas. Vale cada centavo.',
      pros: ['Qualidade premium', 'Entrega rápida', 'Embalagem perfeita'],
      contras: ['Preço um pouco alto'],
      tags: ['recomendo', 'qualidade', 'black-friday'], imagens: [], status: 'aprovado' },
    { produtoId: produtoIds[0] || 1, clienteId: 2, nota: 4,
      titulo: 'Muito bom, quase perfeito', comentario: 'Produto de qualidade, só o preço poderia ser menor.',
      pros: ['Durável', 'Boa aparência'], contras: ['Caro para o que entrega'],
      tags: ['bom', 'custo-beneficio'], imagens: [], status: 'aprovado' },
    { produtoId: produtoIds[0] || 1, clienteId: 3, nota: 3,
      titulo: 'Razoável', comentario: 'Atende o básico mas esperava mais pela faixa de preço.',
      pros: ['Funcional'], contras: ['Acabamento mediano', 'Manual confuso'],
      tags: ['ok', 'basico'], imagens: [], status: 'pendente' },
    { produtoId: produtoIds[1] || 2, clienteId: 1, nota: 5,
      titulo: 'Melhor compra do ano!', comentario: 'Performance excelente. Uso diariamente.',
      pros: ['Rápido', 'Silencioso', 'Econômico'], contras: [],
      tags: ['top', 'performance', 'recomendo'], imagens: [], status: 'aprovado' },
    { produtoId: produtoIds[1] || 2, clienteId: 4, nota: 2,
      titulo: 'Decepcionante', comentario: 'Chegou com defeito. Precisei trocar.',
      pros: ['Design bonito'], contras: ['Veio com defeito', 'Suporte ruim'],
      tags: ['problema', 'defeito'], imagens: [], status: 'rejeitado' },
  ];

  let inseridos = 0;
  for (const a of avaliacoes) {
    try {
      await criar(a);
      inseridos++;
    } catch { /* ignora duplicatas em re-runs */ }
  }
  return { inseridos };
}

async function limpar() {
  return col().deleteMany({});
}

module.exports = { criar, listar, buscarPorId, porProduto, porCliente, atualizar, excluir, media, semearDados, limpar };
