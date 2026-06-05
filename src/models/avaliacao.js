// Model de AvaliacaoProduto — define schema, validação e construtores.
//
// Por que MongoDB aqui?
//   • Arrays nativos: pros, contras, imagens e tags são arrays que, no SQL,
//     exigiriam 4 tabelas extras e JOINs. No MongoDB são campos do documento.
//   • Schema flexível: cada tipo de produto pode ter campos adicionais sem migração.
//   • Sem relacionamento SQL: a avaliação referencia produtoId/clienteId por convenção,
//     sem foreign key — adequado para banco complementar.

const STATUS_VALIDOS = ['pendente', 'aprovado', 'rejeitado'];

// Converte string separada por vírgula ou newline em array limpo
function parseArray(val) {
  if (!val && val !== 0) return [];
  if (Array.isArray(val)) return val.map(String).map(s => s.trim()).filter(Boolean);
  return String(val).split(/[,\n]/).map(s => s.trim()).filter(Boolean);
}

// Valida os dados recebidos antes de inserir/atualizar
function validar(dados, parcial = false) {
  const erros = [];
  if (!parcial) {
    if (!dados.produtoId)        erros.push('produtoId é obrigatório');
    if (!dados.clienteId)        erros.push('clienteId é obrigatório');
    if (!dados.nota)             erros.push('nota é obrigatória');
    if (!dados.titulo?.toString().trim())     erros.push('titulo é obrigatório');
    if (!dados.comentario?.toString().trim()) erros.push('comentario é obrigatório');
  }
  if (dados.nota !== undefined) {
    const n = parseInt(dados.nota, 10);
    if (isNaN(n) || n < 1 || n > 5) erros.push('nota deve ser um número entre 1 e 5');
  }
  if (dados.status !== undefined && !STATUS_VALIDOS.includes(dados.status)) {
    erros.push(`status deve ser: ${STATUS_VALIDOS.join(', ')}`);
  }
  return erros;
}

// Monta o documento completo para inserção
function construir(dados) {
  return {
    produtoId:       parseInt(dados.produtoId, 10),
    clienteId:       parseInt(dados.clienteId, 10),
    nota:            parseInt(dados.nota, 10),
    titulo:          String(dados.titulo).trim(),
    comentario:      String(dados.comentario).trim(),
    pros:            parseArray(dados.pros),
    contras:         parseArray(dados.contras),
    imagens:         parseArray(dados.imagens),
    tags:            parseArray(dados.tags),
    status:          'pendente',          // sempre começa como pendente
    dataCriacao:     new Date(),
    dataAtualizacao: new Date(),
  };
}

// Monta o objeto de atualização (apenas campos fornecidos)
function construirUpdate(dados) {
  const update = { dataAtualizacao: new Date() };

  if (dados.nota      !== undefined) update.nota      = parseInt(dados.nota, 10);
  if (dados.titulo    !== undefined) update.titulo    = String(dados.titulo).trim();
  if (dados.comentario !== undefined) update.comentario = String(dados.comentario).trim();
  if (dados.pros      !== undefined) update.pros      = parseArray(dados.pros);
  if (dados.contras   !== undefined) update.contras   = parseArray(dados.contras);
  if (dados.imagens   !== undefined) update.imagens   = parseArray(dados.imagens);
  if (dados.tags      !== undefined) update.tags      = parseArray(dados.tags);
  if (dados.status    !== undefined) update.status    = dados.status;

  return update;
}

module.exports = { validar, construir, construirUpdate, STATUS_VALIDOS, parseArray };
