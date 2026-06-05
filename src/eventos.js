// Serviço de Eventos — armazena e consulta eventos do sistema no MongoDB.
// O MongoDB é ideal aqui porque cada tipo de evento tem estrutura diferente:
//   PRODUTO_VISUALIZADO → {produtoId, preco, categoria}
//   PAGAMENTO_APROVADO  → {pedidoId, valor, metodo}
// Com schema flexível não é necessário criar colunas novas no PostgreSQL a cada novo evento.

const { getDb } = require('./mongo');

// Tipos de evento permitidos — funciona como enum
const TIPOS = {
  PRODUTO_VISUALIZADO: 'PRODUTO_VISUALIZADO',
  ADICIONADO_CARRINHO: 'ADICIONADO_CARRINHO',
  CHECKOUT_INICIADO:   'CHECKOUT_INICIADO',
  PEDIDO_CRIADO:       'PEDIDO_CRIADO',
  PAGAMENTO_APROVADO:  'PAGAMENTO_APROVADO',
  PAGAMENTO_RECUSADO:  'PAGAMENTO_RECUSADO',
};

function col() { return getDb().collection('eventos'); }

// ── Escrita ───────────────────────────────────────────────────────────────────

async function registrar({ tipo, clienteId, clienteNome, dados = {} }) {
  return col().insertOne({ tipo, clienteId, clienteNome, dados, timestamp: new Date() });
}

// ── Leitura ───────────────────────────────────────────────────────────────────

async function todos({ limit = 50, offset = 0, tipo = null, clienteId = null } = {}) {
  const query = {};
  if (tipo)      query.tipo      = tipo;
  if (clienteId) query.clienteId = parseInt(clienteId, 10);

  const cursor = col().find(query).sort({ timestamp: -1 }).skip(offset).limit(limit);
  const docs   = await cursor.toArray();
  const total  = await col().countDocuments(query);
  return { eventos: docs, total };
}

async function porCliente(clienteId, limit = 50) {
  return col().find({ clienteId: parseInt(clienteId, 10) })
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray();
}

async function porPedido(pedidoId) {
  return col().find({ 'dados.pedidoId': pedidoId })
    .sort({ timestamp: 1 })
    .toArray();
}

// ── Relatório Black Friday ────────────────────────────────────────────────────

async function relatorioBlackFriday() {
  // 1. Total de eventos por tipo (funil de conversão)
  const porTipo = await col().aggregate([
    { $group: { _id: '$tipo', total: { $sum: 1 } } },
    { $sort:  { total: -1 } },
  ]).toArray();

  // 2. Top 5 produtos mais visualizados
  const topVisualizados = await col().aggregate([
    { $match: { tipo: TIPOS.PRODUTO_VISUALIZADO } },
    { $group: { _id: '$dados.produtoNome', views: { $sum: 1 }, preco: { $first: '$dados.preco' } } },
    { $sort:  { views: -1 } },
    { $limit: 5 },
  ]).toArray();

  // 3. Top 5 produtos mais adicionados ao carrinho
  const topCarrinho = await col().aggregate([
    { $match: { tipo: TIPOS.ADICIONADO_CARRINHO } },
    { $group: { _id: '$dados.produtoNome', adds: { $sum: 1 } } },
    { $sort:  { adds: -1 } },
    { $limit: 5 },
  ]).toArray();

  // 4. Receita total de pagamentos aprovados
  const receitaResult = await col().aggregate([
    { $match: { tipo: TIPOS.PAGAMENTO_APROVADO } },
    { $group: { _id: null, total: { $sum: '$dados.valor' } } },
  ]).toArray();

  // 5. Volume de eventos por hora do dia (útil para identificar picos)
  const todosEventos = await col().find({}).toArray();
  const porHora = Array(24).fill(0);
  todosEventos.forEach(e => { porHora[new Date(e.timestamp).getHours()]++; });

  // 6. Clientes únicos ativos
  const clientesUnicos = new Set(todosEventos.map(e => e.clienteId)).size;

  // Monta o funil ordenado
  const contadores = Object.fromEntries(porTipo.map(p => [p._id, p.total]));
  const funil = [
    { etapa: 'Produtos Visualizados', tipo: TIPOS.PRODUTO_VISUALIZADO,  count: contadores[TIPOS.PRODUTO_VISUALIZADO] || 0 },
    { etapa: 'Adicionados ao Carrinho', tipo: TIPOS.ADICIONADO_CARRINHO, count: contadores[TIPOS.ADICIONADO_CARRINHO] || 0 },
    { etapa: 'Checkouts Iniciados', tipo: TIPOS.CHECKOUT_INICIADO,       count: contadores[TIPOS.CHECKOUT_INICIADO]   || 0 },
    { etapa: 'Pedidos Criados',     tipo: TIPOS.PEDIDO_CRIADO,           count: contadores[TIPOS.PEDIDO_CRIADO]       || 0 },
    { etapa: 'Pagamentos Aprovados', tipo: TIPOS.PAGAMENTO_APROVADO,     count: contadores[TIPOS.PAGAMENTO_APROVADO]  || 0 },
    { etapa: 'Pagamentos Recusados', tipo: TIPOS.PAGAMENTO_RECUSADO,     count: contadores[TIPOS.PAGAMENTO_RECUSADO]  || 0 },
  ];

  const totalPedidos    = contadores[TIPOS.PEDIDO_CRIADO] || 0;
  const totalVisitas    = contadores[TIPOS.PRODUTO_VISUALIZADO] || 0;
  const taxaConversao   = totalVisitas > 0 ? ((totalPedidos / totalVisitas) * 100).toFixed(1) : '0.0';

  return {
    totalEventos:  todosEventos.length,
    clientesUnicos,
    totalPedidos,
    receita:       parseFloat((receitaResult[0]?.total || 0).toFixed(2)),
    taxaConversao: parseFloat(taxaConversao),
    funil,
    topVisualizados,
    topCarrinho,
    porHora:       porHora.map((count, hora) => ({ hora, count })),
  };
}

// ── Seed de dados de demonstração ─────────────────────────────────────────────

async function semearDados() {
  const produtos = [
    { id: 1, nome: 'Smart TV 4K 55"',  preco: 2499.90, categoria: 'Eletrônicos' },
    { id: 2, nome: 'Notebook Gamer',    preco: 4999.90, categoria: 'Eletrônicos' },
    { id: 3, nome: 'Tênis Running Pro', preco:  399.90, categoria: 'Esportes' },
    { id: 4, nome: 'Fone Bluetooth',    preco:  299.90, categoria: 'Eletrônicos' },
    { id: 5, nome: 'Cadeira Gamer',     preco: 1299.90, categoria: 'Casa' },
  ];

  const clientes = [
    { id: 1, nome: 'Alice' },
    { id: 2, nome: 'Bruno' },
    { id: 3, nome: 'Carla' },
    { id: 4, nome: 'Diego' },
    { id: 5, nome: 'Eva' },
  ];

  const agora = new Date();
  const eventos = [];

  const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const rndHoras = (max) => new Date(agora - Math.random() * max * 3_600_000);

  // Visualizações de produtos (últimas 24h)
  for (let i = 0; i < 80; i++) {
    const c = rnd(clientes);
    const p = rnd(produtos);
    const ts = rndHoras(24);
    eventos.push({ tipo: TIPOS.PRODUTO_VISUALIZADO, clienteId: c.id, clienteNome: c.nome,
      timestamp: ts, dados: { produtoId: p.id, produtoNome: p.nome, preco: p.preco } });
  }

  // Adições ao carrinho (~60% de quem visualiza)
  for (let i = 0; i < 48; i++) {
    const c = rnd(clientes);
    const p = rnd(produtos);
    const ts = rndHoras(20);
    eventos.push({ tipo: TIPOS.ADICIONADO_CARRINHO, clienteId: c.id, clienteNome: c.nome,
      timestamp: ts, dados: { produtoId: p.id, produtoNome: p.nome, quantidade: Math.ceil(Math.random() * 3), preco: p.preco } });
  }

  // Checkouts + pedidos + pagamentos
  for (let i = 0; i < 20; i++) {
    const c = rnd(clientes);
    const p = rnd(produtos);
    const ts = rndHoras(18);
    const pedidoId = `PED-SEED-${i + 1}`;
    const total = p.preco * (1 + Math.floor(Math.random() * 2));
    const aprovado = Math.random() > 0.2;

    eventos.push({ tipo: TIPOS.CHECKOUT_INICIADO, clienteId: c.id, clienteNome: c.nome,
      timestamp: ts, dados: { total, itens: 1 } });
    eventos.push({ tipo: TIPOS.PEDIDO_CRIADO, clienteId: c.id, clienteNome: c.nome,
      timestamp: new Date(ts.getTime() + 30_000), dados: { pedidoId, total, itens: 1 } });

    if (aprovado) {
      eventos.push({ tipo: TIPOS.PAGAMENTO_APROVADO, clienteId: c.id, clienteNome: c.nome,
        timestamp: new Date(ts.getTime() + 90_000), dados: { pedidoId, valor: total, metodo: rnd(['pix','cartao_credito','boleto']) } });
    } else {
      eventos.push({ tipo: TIPOS.PAGAMENTO_RECUSADO, clienteId: c.id, clienteNome: c.nome,
        timestamp: new Date(ts.getTime() + 90_000), dados: { pedidoId, motivo: rnd(['Saldo insuficiente','Cartão bloqueado','Erro no gateway']) } });
    }
  }

  for (const e of eventos) await col().insertOne(e);
  return { inseridos: eventos.length };
}

async function limpar() {
  return col().deleteMany({});
}

module.exports = { registrar, todos, porCliente, porPedido, relatorioBlackFriday, semearDados, limpar, TIPOS };
