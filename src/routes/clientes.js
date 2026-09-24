// ============================================================================
// clientes.js (rota) — Handler HTTP da API de Clientes.
// Traduz requisições HTTP em chamadas ao model (../clientes) e devolve JSON.
// Usa apenas o módulo `http` nativo (sem framework), por isso lê o body na mão.
// ============================================================================

const clientesModule = require('../clientes');   // camada de acesso ao banco

// Lê o corpo da requisição (stream de chunks) e o converte em objeto JSON.
// Retorna {} se o body estiver vazio ou for um JSON inválido (nunca lança erro).
function lerBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', chunk => (body += chunk));               // acumula os pedaços recebidos
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch { resolve({}); } });
  });
}

// Atalho para enviar uma resposta JSON com o status HTTP informado.
function responder(res, status, dados) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(dados));
}

// Roteador de todas as operações de /clientes. Parâmetros:
//   sessao  — sessão do usuário (null = não autenticado)
//   id      — id do cliente na URL (undefined nas rotas de coleção)
//   limit/offset — paginação para a listagem
async function handle(req, res, sessao, id, limit, offset) {
  // Proteção no servidor: nenhuma operação é permitida sem sessão válida.
  if (!sessao) return responder(res, 401, { erro: 'Não autenticado' });

  // GET /clientes → lista (com paginação opcional).
  if (req.method === 'GET' && !id)  return responder(res, 200, await clientesModule.listar(limit, offset));

  // GET /clientes/:id → busca um cliente específico.
  if (req.method === 'GET' && id) {
    const c = await clientesModule.buscar(id);
    return c ? responder(res, 200, c) : responder(res, 404, { erro: 'Cliente não encontrado' });
  }

  // POST /clientes → cria um cliente (nome é obrigatório).
  if (req.method === 'POST') {
    const body = await lerBody(req);
    if (!body.nome) return responder(res, 400, { erro: 'Nome é obrigatório' });
    const c = await clientesModule.criar(body);
    return responder(res, 201, c);   // 201 Created
  }

  // PUT /clientes/:id → atualiza um cliente existente.
  if (req.method === 'PUT' && id) {
    const body = await lerBody(req);
    const c = await clientesModule.atualizar(id, body);
    return c ? responder(res, 200, c) : responder(res, 404, { erro: 'Cliente não encontrado' });
  }

  // DELETE /clientes/:id → remove um cliente.
  if (req.method === 'DELETE' && id) {
    const ok = await clientesModule.deletar(id);
    return ok ? responder(res, 200, { mensagem: 'Cliente removido' }) : responder(res, 404, { erro: 'Cliente não encontrado' });
  }

  // Qualquer outra combinação método/rota não é suportada.
  return responder(res, 405, { erro: 'Método não permitido' });
}

module.exports = { handle };
