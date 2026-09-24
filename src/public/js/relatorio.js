const COR_FUNIL = {
  PRODUTO_VISUALIZADO: '#3b82f6',
  ADICIONADO_CARRINHO: '#10b981',
  CHECKOUT_INICIADO:   '#f59e0b',
  PEDIDO_CRIADO:       '#8b5cf6',
  PAGAMENTO_APROVADO:  '#059669',
  PAGAMENTO_RECUSADO:  '#ef4444',
};

(async () => {
  const usuario = await verificarAuth();
  if (!usuario) return;
  configurarHeader(usuario);
  await carregar();
})();

async function carregar() {
  const res = await fetch('/relatorio/black-friday');
  if (!res.ok) return;
  const data = await res.json();

  if (data.totalEventos === 0) {
    mostrarVazio();
    return;
  }

  renderizarMetrics(data);
  renderizarFunil(data.funil);
  renderizarHBars('top-visualizados', data.topVisualizados, 'views',  '#3b82f6');
  renderizarHBars('top-carrinho',     data.topCarrinho,     'adds',   '#10b981');
  renderizarHoras(data.porHora);
}

async function semearEAtualizar() {
  await fetch('/eventos/seed', { method: 'POST' });
  await carregar();
}

function renderizarMetrics(data) {
  const el = document.getElementById('metric-grid');
  el.innerHTML = `
    <div class="metric-card">
      <div class="metric-value metric-blue">${data.totalEventos.toLocaleString()}</div>
      <div class="metric-label">Total de Eventos</div>
      <div class="metric-sub">MongoDB collection</div>
    </div>
    <div class="metric-card">
      <div class="metric-value metric-purple">${data.totalPedidos}</div>
      <div class="metric-label">Pedidos Criados</div>
      <div class="metric-sub">PEDIDO_CRIADO</div>
    </div>
    <div class="metric-card">
      <div class="metric-value metric-green">R$ ${data.receita.toLocaleString('pt-BR', {minimumFractionDigits:2})}</div>
      <div class="metric-label">Receita Total</div>
      <div class="metric-sub">$sum pagamentos aprovados</div>
    </div>
    <div class="metric-card">
      <div class="metric-value metric-orange">${data.taxaConversao}%</div>
      <div class="metric-label">Taxa de Conversão</div>
      <div class="metric-sub">Pedidos / Visualizações</div>
    </div>
    <div class="metric-card">
      <div class="metric-value" style="color:#374151">${data.clientesUnicos}</div>
      <div class="metric-label">Clientes Únicos</div>
      <div class="metric-sub">com pelo menos 1 evento</div>
    </div>
  `;
}

function renderizarFunil(funil) {
  const el = document.getElementById('funil');
  if (!funil || funil.length === 0) { el.innerHTML = '<p class="empty-msg">Sem dados</p>'; return; }

  const max = Math.max(...funil.map(f => f.count), 1);
  el.innerHTML = funil.map(f => {
    const pct = Math.max(4, Math.round((f.count / max) * 100));
    const cor = COR_FUNIL[f.tipo] || '#6b7280';
    return `<div class="funnel-item">
      <span class="funnel-label">${escHtml(f.etapa)}</span>
      <div class="funnel-wrap">
        <div class="funnel-bar" style="width:${pct}%;background:${cor}">${f.count > 0 ? f.count : ''}</div>
      </div>
      <span class="funnel-count">${f.count}</span>
    </div>`;
  }).join('');
}

function renderizarHBars(elId, lista, countField, cor) {
  const el = document.getElementById(elId);
  if (!lista || lista.length === 0) {
    el.innerHTML = '<p class="empty-msg">Sem dados</p>';
    return;
  }
  const max = Math.max(...lista.map(i => i[countField]), 1);
  el.innerHTML = lista.map(item => {
    const pct = Math.max(6, Math.round((item[countField] / max) * 100));
    return `<div class="hbar-item">
      <span class="hbar-name" title="${escHtml(item._id || '—')}">${escHtml(item._id || '—')}</span>
      <div class="hbar-wrap">
        <div class="hbar-fill" style="width:${pct}%;background:${cor}">${item[countField]}</div>
      </div>
      <span class="hbar-count">${item[countField]}</span>
    </div>`;
  }).join('');
}

function renderizarHoras(porHora) {
  const chart  = document.getElementById('hora-chart');
  const labels = document.getElementById('hora-labels');
  if (!porHora) return;

  const max = Math.max(...porHora.map(h => h.count), 1);
  chart.innerHTML = porHora.map(h => {
    const pct = Math.max(2, Math.round((h.count / max) * 100));
    const label = `${String(h.hora).padStart(2,'0')}h - ${h.count} Ev.`;
    return `<div class="hora-bar" style="height:${pct}%" title="${label}"></div>`;
  }).join('');

  // Rótulos a cada 4 horas
  labels.innerHTML = porHora.map(h =>
    `<span class="hora-label">${h.hora % 4 === 0 ? String(h.hora).padStart(2,'0') + 'h' : ''}</span>`
  ).join('');
}

function mostrarVazio() {
  document.getElementById('funil').innerHTML           = '<p class="empty-msg">Nenhum evento. Clique em "Gerar Dados de Teste".</p>';
  document.getElementById('top-visualizados').innerHTML = '<p class="empty-msg">Sem dados</p>';
  document.getElementById('top-carrinho').innerHTML    = '<p class="empty-msg">Sem dados</p>';
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
