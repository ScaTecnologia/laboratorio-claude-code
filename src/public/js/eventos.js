let usuarioLogado = null;
let paginaAtual   = 0;
const POR_PAGINA  = 20;
let debounceTimer = null;

(async () => {
  const usuario = await verificarAuth();
  if (!usuario) return;
  usuarioLogado = usuario;
  configurarHeader(usuario);
  if (usuario.role === 'Admin') document.getElementById('btn-limpar').hidden = false;
  await carregar();
})();

function debounceCarregar() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => { paginaAtual = 0; carregar(); }, 400);
}

async function carregar(pagina = 0) {
  paginaAtual = pagina;
  const tipo      = document.getElementById('filtro-tipo').value || null;
  const clienteId = document.getElementById('filtro-cliente').value || null;
  const pedidoId  = document.getElementById('filtro-pedido').value.trim() || null;

  let url;
  if (pedidoId) {
    url = `/eventos/pedido/${encodeURIComponent(pedidoId)}`;
  } else if (clienteId) {
    url = `/eventos/cliente/${clienteId}`;
  } else {
    const params = new URLSearchParams({ limit: POR_PAGINA, offset: pagina * POR_PAGINA });
    if (tipo) params.set('tipo', tipo);
    url = `/eventos?${params}`;
  }

  const res = await fetch(url);
  if (!res.ok) return;
  const data = await res.json();

  // Normaliza — /eventos/cliente e /eventos/pedido retornam array diretamente
  const lista  = Array.isArray(data) ? data : (data.eventos || []);
  const total  = Array.isArray(data) ? data.length : (data.total || 0);

  document.getElementById('total-badge').textContent = `${total} evento(s)`;
  renderizarTabela(lista);
  renderizarPaginacao(total, pagina);
}

function renderizarTabela(lista) {
  const tbody = document.getElementById('tabela-body');
  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="vazio">
      Nenhum evento encontrado. Clique em "Semear Dados Black Friday" para criar eventos de teste.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(e => {
    const ts    = new Date(e.timestamp).toLocaleString('pt-BR');
    const badge = `<span class="badge badge-${e.tipo}" style="font-size:.72rem;white-space:nowrap">${labelTipo(e.tipo)}</span>`;
    const dados = resumirDados(e.tipo, e.dados);
    return `<tr>
      <td>${badge}</td>
      <td>${escHtml(e.clienteNome || '—')} <span style="color:#9ca3af;font-size:.78rem">#${e.clienteId || '?'}</span></td>
      <td style="white-space:nowrap;font-size:.82rem">${ts}</td>
      <td class="evento-dados">${dados}</td>
    </tr>`;
  }).join('');
}

function renderizarPaginacao(total, paginaAtual) {
  const el = document.getElementById('paginacao');
  const totalPaginas = Math.ceil(total / POR_PAGINA);
  if (totalPaginas <= 1) { el.innerHTML = ''; return; }

  el.innerHTML = `
    <button class="btn btn-sm btn-secondary" onclick="carregar(${paginaAtual - 1})" ${paginaAtual === 0 ? 'disabled' : ''}>← Anterior</button>
    <span style="font-size:.85rem;color:#6b7280">Página ${paginaAtual + 1} de ${totalPaginas}</span>
    <button class="btn btn-sm btn-secondary" onclick="carregar(${paginaAtual + 1})" ${paginaAtual >= totalPaginas - 1 ? 'disabled' : ''}>Próxima →</button>
  `;
}

function labelTipo(tipo) {
  const labels = {
    PRODUTO_VISUALIZADO: '👁️ Visualizou',
    ADICIONADO_CARRINHO: '🛒 Carrinho',
    CHECKOUT_INICIADO:   '📋 Checkout',
    PEDIDO_CRIADO:       '📦 Pedido',
    PAGAMENTO_APROVADO:  '✅ Aprovado',
    PAGAMENTO_RECUSADO:  '❌ Recusado',
  };
  return labels[tipo] || tipo;
}

function resumirDados(tipo, dados = {}) {
  if (!dados) return '—';
  if (tipo === 'PRODUTO_VISUALIZADO')
    return `${escHtml(dados.produtoNome || '')} — R$ ${parseFloat(dados.preco || 0).toFixed(2)}`;
  if (tipo === 'ADICIONADO_CARRINHO')
    return `${escHtml(dados.produtoNome || `Produto #${dados.produtoId}`)} × ${dados.quantidade || 1}`;
  if (tipo === 'CHECKOUT_INICIADO')
    return dados.total ? `Total: R$ ${parseFloat(dados.total).toFixed(2)}` : '—';
  if (tipo === 'PEDIDO_CRIADO')
    return `${escHtml(dados.pedidoId || '—')} — R$ ${parseFloat(dados.total || 0).toFixed(2)} (${dados.itens || 0} item(ns))`;
  if (tipo === 'PAGAMENTO_APROVADO')
    return `${escHtml(dados.pedidoId || '—')} — R$ ${parseFloat(dados.valor || 0).toFixed(2)} via ${escHtml(dados.metodo || '—')}`;
  if (tipo === 'PAGAMENTO_RECUSADO')
    return `${escHtml(dados.pedidoId || '—')} — ${escHtml(dados.motivo || '—')}`;
  return JSON.stringify(dados).slice(0, 80);
}

async function semearDados() {
  mostrarMensagem('Semeando dados de demonstração...', 'ok');
  const res = await fetch('/eventos/seed', { method: 'POST' });
  if (!res.ok) return mostrarMensagem('Erro ao semear dados.', 'err');
  const data = await res.json();
  mostrarMensagem(`${data.inseridos} eventos criados com sucesso!`, 'ok');
  paginaAtual = 0;
  carregar();
}

async function limparEventos() {
  if (!confirm('Remover TODOS os eventos? Esta ação não pode ser desfeita.')) return;
  const res = await fetch('/eventos', { method: 'DELETE' });
  const data = await res.json();
  mostrarMensagem(`${data.deletados} eventos removidos.`, 'ok');
  carregar();
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
