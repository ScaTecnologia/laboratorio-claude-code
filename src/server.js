const http = require('http');
const fs   = require('fs');
const path = require('path');

const usuariosModule = require('./usuarios');
const clientesModule = require('./clientes');
const produtosModule = require('./produtos');
const estoqueModule  = require('./estoque');
const carrinhoModule = require('./carrinho');
const sessoes        = require('./sessoes');
const redis          = require('./redis');
const mongoModule        = require('./mongo');
const eventoModule       = require('./eventos');
const avaliacoesModule   = require('./avaliacoes');

// ── Helpers ───────────────────────────────────────────────────────────────────

function lerBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch { resolve({}); } });
  });
}

function responder(res, status, dados) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(dados));
}

function parseCookies(req) {
  const cookies = {};
  (req.headers.cookie || '').split(';').forEach(part => {
    const [name, ...rest] = part.trim().split('=');
    if (name) cookies[name.trim()] = rest.join('=').trim();
  });
  return cookies;
}

function getSessao(req) {
  return sessoes.buscar(parseCookies(req).sessao_id);
}

function setCookie(res, name, value, opts = {}) {
  let cookie = `${name}=${value}; HttpOnly; Path=/`;
  if (opts.maxAge !== undefined) cookie += `; Max-Age=${opts.maxAge}`;
  res.setHeader('Set-Cookie', cookie);
}

function servirArquivo(res, filePath) {
  const tipos = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json' };
  res.writeHead(200, { 'Content-Type': tipos[path.extname(filePath)] || 'text/plain' });
  res.end(fs.readFileSync(filePath));
}

function proxyParaPython(req, res) {
  return new Promise(resolve => {
    const options = { hostname: 'localhost', port: 3001, path: req.url, method: req.method,
                      headers: { 'Content-Type': 'application/json' } };
    const proxyReq = http.request(options, proxyRes => {
      res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
      proxyRes.pipe(res, { end: true });
      resolve();
    });
    proxyReq.on('error', () => {
      responder(res, 502, { erro: 'Serviço de fornecedores indisponível. Inicie: python src/fornecedores_api.py' });
      resolve();
    });
    req.pipe(proxyReq, { end: true });
  });
}

// Dispara evento no MongoDB sem bloquear a resposta principal (fire-and-forget)
function dispararEvento(dados) {
  eventoModule.registrar(dados).catch(e => console.error('[MongoDB] Erro ao registrar evento:', e.message));
}

// ── Server ────────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url     = req.url.split('?')[0];
  const qs      = new URLSearchParams(req.url.includes('?') ? req.url.split('?')[1] : '');
  const partes  = url.split('/').filter(Boolean);
  const recurso = partes[0];
  const id      = partes[1] ? Number(partes[1]) : null;
  const limit   = qs.has('limit')  ? Math.max(1, parseInt(qs.get('limit'),  10) || 10) : null;
  const offset  = qs.has('offset') ? Math.max(0, parseInt(qs.get('offset'), 10) || 0)  : 0;
  const sessao  = await getSessao(req);

  // ── Páginas estáticas ──────────────────────────────────────────────────────

  if (!recurso) return servirArquivo(res, path.join(__dirname, 'public', 'index.html'));
  if (url === '/login.html')        return servirArquivo(res, path.join(__dirname, 'public', 'login.html'));
  if (url === '/fornecedores.html') return servirArquivo(res, path.join(__dirname, 'public', 'fornecedores.html'));
  if (url === '/api-docs')          return servirArquivo(res, path.join(__dirname, 'public', 'swagger.html'));

  // ── Auth ───────────────────────────────────────────────────────────────────

  if (url === '/login' && req.method === 'POST') {
    const { email, senha } = await lerBody(req);
    if (!email || !senha) return responder(res, 400, { erro: 'E-mail e senha são obrigatórios' });
    const usuario = await usuariosModule.buscarPorEmail(email);
    if (!usuario) return responder(res, 401, { erro: 'Credenciais inválidas' });
    const ok = await usuariosModule.verificarSenha(senha, usuario.senha);
    if (!ok) return responder(res, 401, { erro: 'Credenciais inválidas' });
    const sessaoId = await sessoes.criar({ userId: usuario.id, role: usuario.role, nome: usuario.nome });
    setCookie(res, 'sessao_id', sessaoId, { maxAge: 86400 * 7 });
    return responder(res, 200, { id: usuario.id, nome: usuario.nome, role: usuario.role });
  }

  if (url === '/logout' && req.method === 'POST') {
    const { sessao_id } = parseCookies(req);
    if (sessao_id) await sessoes.encerrar(sessao_id);
    setCookie(res, 'sessao_id', '', { maxAge: 0 });
    return responder(res, 200, { mensagem: 'Sessão encerrada' });
  }

  if (url === '/me' && req.method === 'GET') {
    if (!sessao) return responder(res, 401, { erro: 'Não autenticado' });
    return responder(res, 200, { id: sessao.userId, nome: sessao.nome, role: sessao.role });
  }

  // ── CRUD Usuários — Admin only ─────────────────────────────────────────────

  if (recurso === 'usuarios') {
    if (!sessao)                  return responder(res, 401, { erro: 'Não autenticado' });
    if (sessao.role !== 'Admin')  return responder(res, 403, { erro: 'Acesso restrito a administradores' });

    if (req.method === 'GET' && !id)  return responder(res, 200, await usuariosModule.listar(limit, offset));
    if (req.method === 'GET' && id) {
      const u = await usuariosModule.buscar(id);
      return u ? responder(res, 200, u) : responder(res, 404, { erro: 'Usuário não encontrado' });
    }
    if (req.method === 'POST') {
      const { nome, email, senha, role } = await lerBody(req);
      if (!nome || !email || !senha) return responder(res, 400, { erro: 'Nome, e-mail e senha são obrigatórios' });
      const u = await usuariosModule.criar(nome, email, senha, role || 'Atendente');
      return responder(res, 201, u);
    }
    if (req.method === 'PUT' && id) {
      const body = await lerBody(req);
      const u = await usuariosModule.atualizar(id, body);
      return u ? responder(res, 200, u) : responder(res, 404, { erro: 'Usuário não encontrado' });
    }
    if (req.method === 'DELETE' && id) {
      if (id === 1) return responder(res, 400, { erro: 'Não é possível remover o administrador principal' });
      const ok = await usuariosModule.deletar(id);
      return ok ? responder(res, 200, { mensagem: 'Usuário removido' }) : responder(res, 404, { erro: 'Usuário não encontrado' });
    }
    return responder(res, 405, { erro: 'Método não permitido' });
  }

  // ── CRUD Clientes — autenticado ────────────────────────────────────────────

  if (recurso === 'clientes') {
    if (!sessao) return responder(res, 401, { erro: 'Não autenticado' });

    if (req.method === 'GET' && !id)  return responder(res, 200, await clientesModule.listar(limit, offset));
    if (req.method === 'GET' && id) {
      const c = await clientesModule.buscar(id);
      return c ? responder(res, 200, c) : responder(res, 404, { erro: 'Cliente não encontrado' });
    }
    if (req.method === 'POST') {
      const body = await lerBody(req);
      if (!body.nome) return responder(res, 400, { erro: 'Nome é obrigatório' });
      const c = await clientesModule.criar(body);
      return responder(res, 201, c);
    }
    if (req.method === 'PUT' && id) {
      const body = await lerBody(req);
      const c = await clientesModule.atualizar(id, body);
      return c ? responder(res, 200, c) : responder(res, 404, { erro: 'Cliente não encontrado' });
    }
    if (req.method === 'DELETE' && id) {
      const ok = await clientesModule.deletar(id);
      return ok ? responder(res, 200, { mensagem: 'Cliente removido' }) : responder(res, 404, { erro: 'Cliente não encontrado' });
    }
    return responder(res, 405, { erro: 'Método não permitido' });
  }

  // ── CRUD Fornecedores — proxy para Python ──────────────────────────────────

  if (recurso === 'fornecedores') {
    if (!sessao) return responder(res, 401, { erro: 'Não autenticado' });
    return proxyParaPython(req, res);
  }

  // ── Categorias ─────────────────────────────────────────────────────────────

  if (recurso === 'categorias' && req.method === 'GET') {
    return responder(res, 200, await produtosModule.listarCategorias());
  }

  // ── CRUD Produtos — leitura pública, escrita Admin ─────────────────────────

  if (recurso === 'produtos') {
    if (req.method === 'DELETE' && partes[1] === 'cache') {
      if (!sessao)                 return responder(res, 401, { erro: 'Não autenticado' });
      if (sessao.role !== 'Admin') return responder(res, 403, { erro: 'Acesso restrito a administradores' });
      await produtosModule.invalidarCache();
      return responder(res, 200, { mensagem: 'Cache de produtos invalidado' });
    }

    if (req.method === 'GET' && !id) {
      const resultado = await produtosModule.listar(limit, offset);
      res.setHeader('X-Cache',     resultado.origem === 'redis' ? 'HIT' : 'MISS');
      res.setHeader('X-Cache-TTL', String(resultado.ttl || 0));
      return responder(res, 200, resultado);
    }

    if (req.method === 'GET' && id) {
      const resultado = await produtosModule.buscar(id);
      if (!resultado.dados) return responder(res, 404, { erro: 'Produto não encontrado' });
      res.setHeader('X-Cache',     resultado.origem === 'redis' ? 'HIT' : 'MISS');
      res.setHeader('X-Cache-TTL', String(resultado.ttl || 0));

      // Dispara evento de visualização de produto no MongoDB (fire-and-forget)
      if (sessao) {
        dispararEvento({
          tipo:        eventoModule.TIPOS.PRODUTO_VISUALIZADO,
          clienteId:   sessao.userId,
          clienteNome: sessao.nome,
          dados: { produtoId: id, produtoNome: resultado.dados.nome, preco: resultado.dados.preco },
        });
      }

      return responder(res, 200, resultado);
    }

    if (req.method === 'POST') {
      if (!sessao)                 return responder(res, 401, { erro: 'Não autenticado' });
      if (sessao.role !== 'Admin') return responder(res, 403, { erro: 'Acesso restrito a administradores' });
      const body = await lerBody(req);
      if (!body.nome)  return responder(res, 400, { erro: 'Nome é obrigatório' });
      if (body.preco === undefined) return responder(res, 400, { erro: 'Preço é obrigatório' });
      const p = await produtosModule.criar(body);
      return responder(res, 201, p);
    }

    if (req.method === 'PUT' && id) {
      if (!sessao)                 return responder(res, 401, { erro: 'Não autenticado' });
      if (sessao.role !== 'Admin') return responder(res, 403, { erro: 'Acesso restrito a administradores' });
      const body = await lerBody(req);
      const p = await produtosModule.atualizar(id, body);
      return p ? responder(res, 200, p) : responder(res, 404, { erro: 'Produto não encontrado' });
    }

    if (req.method === 'DELETE' && id) {
      if (!sessao)                 return responder(res, 401, { erro: 'Não autenticado' });
      if (sessao.role !== 'Admin') return responder(res, 403, { erro: 'Acesso restrito a administradores' });
      const ok = await produtosModule.deletar(id);
      return ok ? responder(res, 200, { mensagem: 'Produto removido' }) : responder(res, 404, { erro: 'Produto não encontrado' });
    }

    return responder(res, 405, { erro: 'Método não permitido' });
  }

  // ── Estoque ────────────────────────────────────────────────────────────────

  if (recurso === 'estoque') {
    if (!sessao) return responder(res, 401, { erro: 'Não autenticado' });
    const produtoId = partes[1] ? parseInt(partes[1], 10) : null;

    if (req.method === 'GET' && !produtoId) return responder(res, 200, await estoqueModule.listar());

    if (req.method === 'GET' && produtoId && !partes[2]) {
      const e = await estoqueModule.buscar(produtoId);
      return e ? responder(res, 200, e) : responder(res, 404, { erro: 'Estoque não encontrado' });
    }

    if (req.method === 'PUT' && produtoId && !partes[2]) {
      if (sessao.role !== 'Admin') return responder(res, 403, { erro: 'Acesso restrito a administradores' });
      const { quantidade } = await lerBody(req);
      if (quantidade === undefined || quantidade < 0) return responder(res, 400, { erro: 'Quantidade inválida' });
      const e = await estoqueModule.atualizar(produtoId, quantidade);
      return responder(res, 200, e);
    }

    if (req.method === 'POST' && produtoId && partes[2] === 'reservar') {
      const { quantidade } = await lerBody(req);
      if (!quantidade || quantidade <= 0) return responder(res, 400, { erro: 'Quantidade deve ser maior que zero' });
      try {
        const r = await estoqueModule.reservar(produtoId, quantidade);
        return responder(res, 200, r);
      } catch (e) {
        return responder(res, 409, { erro: e.message });
      }
    }

    if (req.method === 'DELETE' && produtoId && partes[2] === 'reserva') {
      const qtd = qs.has('quantidade') ? parseInt(qs.get('quantidade'), 10) : null;
      const novo = qtd ? await estoqueModule.liberarReserva(produtoId, qtd)
                       : (await redis.del(`reserva:${produtoId}`), 0);
      return responder(res, 200, { reservado: novo });
    }

    if (req.method === 'POST' && produtoId && partes[2] === 'confirmar') {
      if (sessao.role !== 'Admin') return responder(res, 403, { erro: 'Acesso restrito a administradores' });
      const { quantidade, pedidoId, valor } = await lerBody(req);
      if (!quantidade || quantidade <= 0) return responder(res, 400, { erro: 'Quantidade inválida' });
      await estoqueModule.confirmarVenda(produtoId, quantidade);

      // Dispara PAGAMENTO_APROVADO no MongoDB
      dispararEvento({
        tipo:        eventoModule.TIPOS.PAGAMENTO_APROVADO,
        clienteId:   sessao.userId,
        clienteNome: sessao.nome,
        dados: { produtoId, quantidade, pedidoId: pedidoId || null, valor: valor || null },
      });

      return responder(res, 200, { mensagem: 'Venda confirmada, estoque debitado' });
    }

    return responder(res, 405, { erro: 'Método não permitido' });
  }

  // ── Carrinho — 100% Redis ──────────────────────────────────────────────────

  if (recurso === 'carrinho') {
    if (!sessao) return responder(res, 401, { erro: 'Não autenticado' });
    const clienteId = sessao.userId;

    if (req.method === 'GET' && !partes[1]) {
      return responder(res, 200, await carrinhoModule.obter(clienteId));
    }

    if (req.method === 'POST' && partes[1] === 'itens') {
      const { produtoId, quantidade } = await lerBody(req);
      if (!produtoId) return responder(res, 400, { erro: 'produtoId é obrigatório' });
      const carrinho = await carrinhoModule.adicionarItem(clienteId, produtoId, quantidade || 1);

      // Dispara ADICIONADO_CARRINHO no MongoDB (fire-and-forget)
      dispararEvento({
        tipo:        eventoModule.TIPOS.ADICIONADO_CARRINHO,
        clienteId:   sessao.userId,
        clienteNome: sessao.nome,
        dados: { produtoId, quantidade: quantidade || 1 },
      });

      return responder(res, 200, carrinho);
    }

    if (req.method === 'PUT' && partes[1] === 'itens' && partes[2]) {
      const produtoId = parseInt(partes[2], 10);
      const { quantidade } = await lerBody(req);
      const carrinho = await carrinhoModule.adicionarItem(clienteId, produtoId, quantidade);
      return responder(res, 200, carrinho);
    }

    if (req.method === 'DELETE' && partes[1] === 'itens' && partes[2]) {
      const produtoId = parseInt(partes[2], 10);
      return responder(res, 200, await carrinhoModule.removerItem(clienteId, produtoId));
    }

    if (req.method === 'DELETE' && !partes[1]) {
      await carrinhoModule.limpar(clienteId);
      return responder(res, 200, { mensagem: 'Carrinho limpo' });
    }

    if (req.method === 'POST' && partes[1] === 'checkout') {
      // Dispara CHECKOUT_INICIADO antes de processar
      dispararEvento({
        tipo:        eventoModule.TIPOS.CHECKOUT_INICIADO,
        clienteId:   sessao.userId,
        clienteNome: sessao.nome,
        dados:       { sessaoId: parseCookies(req).sessao_id?.slice(0, 8) },
      });

      try {
        const resultado = await carrinhoModule.checkout(clienteId);

        // Gera pedidoId e dispara PEDIDO_CRIADO
        const pedidoId = `PED-${Date.now()}`;
        dispararEvento({
          tipo:        eventoModule.TIPOS.PEDIDO_CRIADO,
          clienteId:   sessao.userId,
          clienteNome: sessao.nome,
          dados: { pedidoId, total: resultado.total, itens: resultado.itens.length },
        });

        return responder(res, 200, { ...resultado, pedidoId });
      } catch (e) {
        // Dispara PAGAMENTO_RECUSADO em caso de falha
        dispararEvento({
          tipo:        eventoModule.TIPOS.PAGAMENTO_RECUSADO,
          clienteId:   sessao.userId,
          clienteNome: sessao.nome,
          dados: { motivo: e.message },
        });
        return responder(res, 409, { erro: e.message });
      }
    }

    return responder(res, 405, { erro: 'Método não permitido' });
  }

  // ── Avaliações de Produtos — MongoDB ──────────────────────────────────────────

  if (recurso === 'avaliacoes') {
    if (!sessao) return responder(res, 401, { erro: 'Não autenticado' });

    const sub    = partes[1];   // 'produto', 'cliente' ou ObjectId string
    const sub2   = partes[2];   // id numérico ou 'media'
    const sub3   = partes[3];   // 'media'

    // POST /avaliacoes — criar avaliação (autenticado)
    if (req.method === 'POST' && !sub) {
      const body = await lerBody(req);
      // Se o clienteId não veio no body, usa o usuário logado
      if (!body.clienteId) body.clienteId = sessao.userId;
      try {
        const av = await avaliacoesModule.criar(body);
        return responder(res, 201, av);
      } catch (e) {
        return responder(res, 400, { erro: e.message });
      }
    }

    // GET /avaliacoes — listar com filtros opcionais
    if (req.method === 'GET' && !sub) {
      const filtros = {
        limit:     qs.has('limit')     ? parseInt(qs.get('limit'),     10) : 20,
        offset:    qs.has('offset')    ? parseInt(qs.get('offset'),    10) : 0,
        status:    qs.get('status')    || null,
        produtoId: qs.get('produtoId') || null,
        clienteId: qs.get('clienteId') || null,
        nota:      qs.get('nota')      || null,
      };
      return responder(res, 200, await avaliacoesModule.listar(filtros));
    }

    // GET /avaliacoes/produto/:id/media — média + distribuição de notas
    if (req.method === 'GET' && sub === 'produto' && sub2 && sub3 === 'media') {
      return responder(res, 200, await avaliacoesModule.media(sub2));
    }

    // GET /avaliacoes/produto/:id — avaliações de um produto
    if (req.method === 'GET' && sub === 'produto' && sub2 && !sub3) {
      const filtros = {
        status:  qs.get('status') || null,
        limit:   qs.has('limit')  ? parseInt(qs.get('limit'),  10) : 20,
        offset:  qs.has('offset') ? parseInt(qs.get('offset'), 10) : 0,
      };
      return responder(res, 200, await avaliacoesModule.porProduto(sub2, filtros));
    }

    // GET /avaliacoes/cliente/:id — avaliações de um cliente
    if (req.method === 'GET' && sub === 'cliente' && sub2) {
      return responder(res, 200, await avaliacoesModule.porCliente(sub2));
    }

    // Rotas por ObjectId — sub é o _id string (não é 'produto' nem 'cliente')
    const isObjectId = sub && sub !== 'produto' && sub !== 'cliente';

    if (req.method === 'GET' && isObjectId) {
      const av = await avaliacoesModule.buscarPorId(sub);
      return av ? responder(res, 200, av) : responder(res, 404, { erro: 'Avaliação não encontrada' });
    }

    if (req.method === 'PUT' && isObjectId) {
      const body = await lerBody(req);
      // Somente Admin pode mudar o status (aprovado/rejeitado)
      if (body.status && sessao.role !== 'Admin') {
        return responder(res, 403, { erro: 'Somente Admin pode alterar o status da avaliação' });
      }
      try {
        const av = await avaliacoesModule.atualizar(sub, body);
        return av ? responder(res, 200, av) : responder(res, 404, { erro: 'Avaliação não encontrada' });
      } catch (e) {
        return responder(res, 400, { erro: e.message });
      }
    }

    if (req.method === 'DELETE' && isObjectId) {
      if (sessao.role !== 'Admin') return responder(res, 403, { erro: 'Somente Admin pode excluir avaliações' });
      const ok = await avaliacoesModule.excluir(sub);
      return ok ? responder(res, 200, { mensagem: 'Avaliação excluída' }) : responder(res, 404, { erro: 'Avaliação não encontrada' });
    }

    // POST /avaliacoes/seed — dados de demonstração
    if (req.method === 'POST' && sub === 'seed') {
      const { rows: produtos } = await require('./db').pool.query('SELECT id FROM produtos LIMIT 2');
      const ids = produtos.map(p => p.id);
      const r   = await avaliacoesModule.semearDados(ids.length >= 2 ? ids : [1, 2]);
      return responder(res, 200, r);
    }

    return responder(res, 405, { erro: 'Método não permitido' });
  }

  // ── Eventos — MongoDB ──────────────────────────────────────────────────────

  if (recurso === 'eventos') {
    if (!sessao) return responder(res, 401, { erro: 'Não autenticado' });

    const sub   = partes[1];  // 'cliente', 'pedido', 'seed', ou undefined
    const subId = partes[2];  // ID dentro da sub-rota

    // GET /eventos — lista com filtros opcionais (?tipo=X&clienteId=Y)
    if (req.method === 'GET' && !sub) {
      const tipo      = qs.get('tipo')      || null;
      const cId       = qs.get('clienteId') || null;
      const lim       = qs.has('limit')  ? parseInt(qs.get('limit'),  10) : 50;
      const off       = qs.has('offset') ? parseInt(qs.get('offset'), 10) : 0;
      return responder(res, 200, await eventoModule.todos({ limit: lim, offset: off, tipo, clienteId: cId }));
    }

    // GET /eventos/cliente/:id — histórico de um cliente
    if (req.method === 'GET' && sub === 'cliente' && subId) {
      return responder(res, 200, await eventoModule.porCliente(subId));
    }

    // GET /eventos/pedido/:pedidoId — rastreia um pedido
    if (req.method === 'GET' && sub === 'pedido' && subId) {
      return responder(res, 200, await eventoModule.porPedido(subId));
    }

    // POST /eventos/seed — semeia dados de demonstração
    if (req.method === 'POST' && sub === 'seed') {
      const resultado = await eventoModule.semearDados();
      return responder(res, 200, resultado);
    }

    // DELETE /eventos — limpa todos os eventos (Admin)
    if (req.method === 'DELETE' && !sub) {
      if (sessao.role !== 'Admin') return responder(res, 403, { erro: 'Acesso restrito a administradores' });
      const r = await eventoModule.limpar();
      return responder(res, 200, { deletados: r.deletedCount });
    }

    return responder(res, 405, { erro: 'Método não permitido' });
  }

  // ── Relatório Black Friday — MongoDB Aggregation ───────────────────────────

  if (recurso === 'relatorio') {
    if (!sessao) return responder(res, 401, { erro: 'Não autenticado' });

    if (req.method === 'GET' && partes[1] === 'black-friday') {
      return responder(res, 200, await eventoModule.relatorioBlackFriday());
    }

    return responder(res, 404, { erro: 'Relatório não encontrado' });
  }

  // ── Redis Status ───────────────────────────────────────────────────────────

  if (url === '/redis-status' && req.method === 'GET') {
    if (!sessao) return responder(res, 401, { erro: 'Não autenticado' });
    try {
      const ping  = await redis.ping();
      const chaves = await redis.dbsize();
      return responder(res, 200, { status: ping === 'PONG' ? 'ok' : 'erro', total_chaves: chaves });
    } catch (e) {
      return responder(res, 503, { status: 'indisponível', erro: e.message });
    }
  }

  // ── Arquivos estáticos ─────────────────────────────────────────────────────

  const publicDir = path.join(__dirname, 'public');
  const filePath  = path.resolve(publicDir, url.slice(1));
  if (filePath.startsWith(publicDir) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return servirArquivo(res, filePath);
  }

  responder(res, 404, { erro: 'Rota não encontrada' });
});

// ── Start ─────────────────────────────────────────────────────────────────────

usuariosModule.inicializar()
  .then(() => clientesModule.inicializar())
  .then(() => sessoes.inicializar())
  .then(() => produtosModule.inicializar())
  .then(() => mongoModule.conectar())
  .then(() => server.listen(3000, () => console.log('Servidor rodando em http://localhost:3000')))
  .catch(err => { console.error('Erro ao inicializar:', err.message); process.exit(1); });
