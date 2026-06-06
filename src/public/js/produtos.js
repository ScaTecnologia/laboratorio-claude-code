let usuarioLogado = null;
let paginaAtual   = 0;
const POR_PAGINA  = 20;

(async () => {
  const usuario = await verificarAuth();
  if (!usuario) return;
  usuarioLogado = usuario;
  configurarHeader(usuario);

  if (usuario.role === 'Admin') {
    document.getElementById('card-form').hidden        = false;
    document.getElementById('btn-limpar-cache').hidden = false;
  }

  await carregarCategorias();
  await carregar();
})();

async function carregarCategorias() {
  const res = await fetch('/categorias');
  if (!res.ok) return;
  const cats = await res.json();
  const sel  = document.getElementById('categoria_id');
  sel.innerHTML = '<option value="">— Selecione —</option>' +
    cats.map(c => `<option value="${c.id}">${escHtml(c.nome)}</option>`).join('');
}

async function carregar(pagina = 0) {
  paginaAtual = pagina;
  const params = new URLSearchParams({ limit: POR_PAGINA, offset: pagina * POR_PAGINA });
  const res = await fetch(`/produtos?${params}`);
  if (!res.ok) return;
  const resultado = await res.json();

  // Exibe o badge de origem: Redis (HIT) ou Banco (MISS)
  const badge = document.getElementById('cache-badge');
  const ttlEl = document.getElementById('cache-ttl');

  if (resultado.origem === 'redis') {
    badge.textContent = '⚡ Cache Redis (HIT)';
    badge.className   = 'badge badge-redis';
    ttlEl.textContent = `TTL restante: ${resultado.ttl}s — próxima consulta ainda vem do cache`;
  } else {
    badge.textContent = '🗄️ Banco de Dados (MISS)';
    badge.className   = 'badge badge-db';
    ttlEl.textContent = `Cache renovado — expira em ${resultado.ttl}s`;
  }

  const lista  = resultado.dados || [];
  const total  = resultado.total || 0;
  const tbody  = document.getElementById('tabela-body');

  if (lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="vazio">Nenhum produto cadastrado. Use o formulário acima para adicionar.</td></tr>';
    renderizarPaginacao(0, 0);
    return;
  }

  tbody.innerHTML = lista.map(p => {
    const est = parseInt(p.estoque || 0);
    const estCls = est === 0 ? 'est-zero' : est <= 5 ? 'est-baixo' : 'est-alto';
    const statusBadge = p.ativo
      ? '<span class="badge" style="background:#10b981;color:#fff;font-size:.75rem">Ativo</span>'
      : '<span class="badge" style="background:#9ca3af;color:#fff;font-size:.75rem">Inativo</span>';
    const acoes = usuarioLogado?.role === 'Admin'
      ? `<button class="btn btn-sm btn-secondary" onclick="editar(${p.id})">Editar</button>
         <button class="btn btn-sm btn-danger" onclick="deletar(${p.id})">Deletar</button>`
      : '—';
    return `<tr>
      <td class="td-id">${p.id}</td>
      <td>${escHtml(p.nome)}</td>
      <td>${escHtml(p.categoria || '—')}</td>
      <td>R$ ${parseFloat(p.preco).toFixed(2)}</td>
      <td class="${estCls}">${est}</td>
      <td>${statusBadge}</td>
      <td class="acoes">${acoes}</td>
    </tr>`;
  }).join('');

  renderizarPaginacao(total, pagina);
}

function renderizarPaginacao(total, pagAtual) {
  const el = document.getElementById('paginacao');
  if (!el) return;
  const totalPags = Math.ceil(total / POR_PAGINA);
  const mostrando = Math.min(pagAtual * POR_PAGINA + POR_PAGINA, total);
  const inicio    = total === 0 ? 0 : pagAtual * POR_PAGINA + 1;

  if (totalPags <= 1) {
    el.innerHTML = total > 0
      ? `<span style="font-size:.85rem;color:#6b7280">${total} produto(s)</span>`
      : '';
    return;
  }

  el.innerHTML = `
    <button class="btn btn-sm btn-secondary" onclick="carregar(${pagAtual - 1})" ${pagAtual === 0 ? 'disabled' : ''}>← Anterior</button>
    <span style="font-size:.85rem;color:#6b7280">
      ${inicio}–${mostrando} de ${total} produtos &nbsp;|&nbsp; Página ${pagAtual + 1} de ${totalPags}
    </span>
    <button class="btn btn-sm btn-secondary" onclick="carregar(${pagAtual + 1})" ${pagAtual >= totalPags - 1 ? 'disabled' : ''}>Próxima →</button>
  `;
}

async function salvar(event) {
  event.preventDefault();
  const id    = document.getElementById('produto-id').value;
  const nome  = document.getElementById('nome').value.trim();
  const preco = parseFloat(document.getElementById('preco').value);

  if (!nome)            return mostrarMensagem('Nome é obrigatório.', 'err');
  if (isNaN(preco) || preco < 0) return mostrarMensagem('Preço inválido.', 'err');

  const body = {
    nome,
    descricao:    document.getElementById('descricao').value.trim() || null,
    preco,
    categoria_id: parseInt(document.getElementById('categoria_id').value) || null,
    ativo:        document.getElementById('ativo').value === 'true',
  };
  if (!id) {
    body.quantidade = parseInt(document.getElementById('quantidade_inicial').value) || 0;
  }

  const res = await fetch(id ? `/produtos/${id}` : '/produtos', {
    method:  id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json();
    return mostrarMensagem(data.erro || 'Erro ao salvar.', 'err');
  }

  mostrarMensagem(id ? 'Produto atualizado! Cache invalidado automaticamente.' : 'Produto criado!', 'ok');
  cancelarEdicao();
  carregar(id ? paginaAtual : 0);
}

async function editar(id) {
  const res = await fetch(`/produtos/${id}`);
  if (!res.ok) return;
  const resultado = await res.json();
  const p = resultado.dados;

  document.getElementById('produto-id').value       = p.id;
  document.getElementById('nome').value             = p.nome;
  document.getElementById('descricao').value        = p.descricao || '';
  document.getElementById('preco').value            = p.preco;
  document.getElementById('categoria_id').value     = p.categoria_id || '';
  document.getElementById('ativo').value            = String(p.ativo);
  document.getElementById('form-titulo').textContent = 'Editar Produto';
  document.getElementById('btn-cancelar').hidden    = false;
  document.getElementById('card-form').scrollIntoView({ behavior: 'smooth' });
}

async function deletar(id) {
  if (!confirm('Remover este produto? Essa ação não pode ser desfeita.')) return;
  const res = await fetch(`/produtos/${id}`, { method: 'DELETE' });
  if (!res.ok) return mostrarMensagem('Erro ao remover produto.', 'err');
  mostrarMensagem('Produto removido. Cache invalidado.', 'ok');
  carregar(paginaAtual);
}

async function limparCache() {
  const res = await fetch('/produtos/cache', { method: 'DELETE' });
  if (!res.ok) return mostrarMensagem('Erro ao limpar cache.', 'err');
  mostrarMensagem('Cache limpo! A próxima consulta irá ao banco de dados.', 'ok');
  carregar(paginaAtual);
}

function cancelarEdicao() {
  ['produto-id','nome','descricao','preco'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('quantidade_inicial').value     = '0';
  document.getElementById('form-titulo').textContent     = 'Novo Produto';
  document.getElementById('btn-cancelar').hidden         = true;
}

function mostrarMensagem(texto, tipo) {
  const el = document.getElementById('mensagem');
  el.textContent = texto;
  el.className   = 'mensagem ' + tipo;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.className = 'mensagem'; }, 5000);
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
