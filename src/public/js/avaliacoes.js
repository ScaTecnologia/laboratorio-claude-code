let usuarioLogado = null;
let paginaAtual   = 0;
const POR_PAGINA  = 10;
let debounceTimer = null;

(async () => {
  const usuario = await verificarAuth();
  if (!usuario) return;
  usuarioLogado = usuario;
  configurarHeader(usuario);
  await carregar();
})();

// ── Seletor de estrelas ───────────────────────────────────────────────────────

function setNota(n) {
  document.getElementById('av-nota').value = n;
  document.querySelectorAll('.star-btn').forEach((btn, i) => {
    btn.classList.toggle('ativa', i < n);
  });
}

function getNota() {
  return parseInt(document.getElementById('av-nota').value, 10) || 0;
}

// ── Carregar lista ────────────────────────────────────────────────────────────

function onChangeProduto() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => { paginaAtual = 0; carregar(); }, 400);
}

async function carregar(pagina = 0) {
  paginaAtual = pagina;
  const produtoId = document.getElementById('filtro-produto').value.trim();
  const status    = document.getElementById('filtro-status').value;
  const nota      = document.getElementById('filtro-nota').value;

  const params = new URLSearchParams({ limit: POR_PAGINA, offset: pagina * POR_PAGINA });
  if (status)    params.set('status',    status);
  if (nota)      params.set('nota',      nota);
  if (produtoId) params.set('produtoId', produtoId);

  const res = await fetch(`/avaliacoes?${params}`);
  if (!res.ok) return;
  const { avaliacoes, total } = await res.json();

  document.getElementById('total-badge').textContent = `${total} avaliação(ões)`;
  renderizarTabela(avaliacoes);
  renderizarPaginacao(total, pagina);

  // Mostra estatísticas do produto se filtro preenchido
  if (produtoId) {
    await carregarMedia(produtoId);
  } else {
    document.getElementById('media-box').style.display = 'none';
  }
}

// ── Média do produto ──────────────────────────────────────────────────────────

async function carregarMedia(produtoId) {
  const res = await fetch(`/avaliacoes/produto/${produtoId}/media`);
  if (!res.ok) return;
  const m = await res.json();

  const el = document.getElementById('media-box');
  el.style.display = 'block';

  if (m.total === 0) {
    el.innerHTML = `<div class="media-card"><span style="color:#9ca3af">Nenhuma avaliação aprovada para este produto.</span></div>`;
    return;
  }

  const maxCount = Math.max(...m.distribuicao.map(d => d.count), 1);
  const distHtml = m.distribuicao.slice().reverse().map(d => `
    <div class="dist-row">
      <span class="dist-label">${d.nota}</span>
      <div class="dist-track">
        <div class="dist-fill" style="width:${Math.round((d.count/maxCount)*100)}%"></div>
      </div>
      <span class="dist-count">${d.count}</span>
    </div>
  `).join('');

  el.innerHTML = `
    <div class="media-card">
      <div>
        <div class="media-nota">${m.media}</div>
        <div class="media-estrelas">${renderEstrelas(Math.round(m.media))}</div>
        <div class="media-total">${m.total} avaliação(ões) aprovada(s)</div>
      </div>
      <div class="dist-bar-wrap">${distHtml}</div>
    </div>
  `;
}

// ── Renderizar tabela ─────────────────────────────────────────────────────────

function renderizarTabela(lista) {
  const tbody = document.getElementById('tabela-body');
  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="vazio">
      Nenhuma avaliação encontrada. Clique em "Criar Avaliações de Teste" para começar.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(av => {
    const statusBadge = `<span class="badge badge-${av.status}" style="font-size:.75rem">${av.status}</span>`;
    const data = new Date(av.dataCriacao).toLocaleDateString('pt-BR');
    const adminBtns = usuarioLogado?.role === 'Admin' ? `
      ${av.status === 'pendente' ? `<button class="btn btn-sm" style="background:#10b981;color:#fff" onclick="moderarStatus('${av._id}','aprovado')">✓ Aprovar</button>
       <button class="btn btn-sm btn-danger" onclick="moderarStatus('${av._id}','rejeitado')">✗ Rejeitar</button>` : ''}
      <button class="btn btn-sm btn-danger" onclick="excluir('${av._id}')">🗑️</button>
    ` : '';

    return `<tr>
      <td><span class="stars-display" style="font-size:1.1rem">${renderEstrelas(av.nota)}</span></td>
      <td>
        <strong>${escHtml(av.titulo)}</strong>
        ${av.tags?.length ? '<br>' + av.tags.map(t => `<span class="tag-chip">#${escHtml(t)}</span>`).join('') : ''}
      </td>
      <td class="td-id">Prod #${av.produtoId}</td>
      <td class="td-id">User #${av.clienteId}</td>
      <td>${statusBadge}</td>
      <td style="font-size:.82rem;white-space:nowrap">${data}</td>
      <td class="acoes">
        <button class="btn btn-sm btn-secondary" onclick="verDetalhe('${av._id}')">Ver</button>
        <button class="btn btn-sm btn-secondary" onclick="editarAvaliacao('${av._id}')">Editar</button>
        ${adminBtns}
      </td>
    </tr>
    <tr id="detalhe-${av._id}" class="detalhe-row" style="display:none">
      <td colspan="7">
        <div class="detalhe-box" id="detalhe-conteudo-${av._id}"></div>
      </td>
    </tr>`;
  }).join('');
}

function renderizarPaginacao(total, pagAtual) {
  const el = document.getElementById('paginacao');
  const totalPags = Math.ceil(total / POR_PAGINA);
  if (totalPags <= 1) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <button class="btn btn-sm btn-secondary" onclick="carregar(${pagAtual-1})" ${pagAtual===0?'disabled':''}>← Anterior</button>
    <span style="font-size:.85rem;color:#6b7280">Página ${pagAtual+1} de ${totalPags}</span>
    <button class="btn btn-sm btn-secondary" onclick="carregar(${pagAtual+1})" ${pagAtual>=totalPags-1?'disabled':''}>Próxima →</button>
  `;
}

// ── Ver detalhe expandido ─────────────────────────────────────────────────────

async function verDetalhe(id) {
  const row = document.getElementById(`detalhe-${id}`);
  if (row.style.display !== 'none') { row.style.display = 'none'; return; }

  const res = await fetch(`/avaliacoes/${id}`);
  if (!res.ok) return;
  const av = await res.json();

  const prosHtml    = av.pros?.map(p => `<span class="tag-chip pro-chip">+ ${escHtml(p)}</span>`).join('') || '—';
  const contrasHtml = av.contras?.map(c => `<span class="tag-chip contra-chip">− ${escHtml(c)}</span>`).join('') || '—';
  const tagsHtml    = av.tags?.map(t => `<span class="tag-chip">#${escHtml(t)}</span>`).join('') || '—';
  const imagensHtml = av.imagens?.length
    ? av.imagens.map(u => `<a href="${escHtml(u)}" target="_blank" style="font-size:.8rem;display:block">${escHtml(u)}</a>`).join('')
    : '—';

  document.getElementById(`detalhe-conteudo-${id}`).innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:8px 0">
      <div>
        <p style="font-size:.82rem;color:#6b7280;margin-bottom:4px">Comentário</p>
        <p style="font-size:.9rem">${escHtml(av.comentario)}</p>
      </div>
      <div>
        <p style="font-size:.82rem;color:#6b7280;margin-bottom:4px">Prós</p>
        <div>${prosHtml}</div>
        <p style="font-size:.82rem;color:#6b7280;margin:8px 0 4px">Contras</p>
        <div>${contrasHtml}</div>
      </div>
      <div>
        <p style="font-size:.82rem;color:#6b7280;margin-bottom:4px">Tags</p>
        <div>${tagsHtml}</div>
      </div>
      <div>
        <p style="font-size:.82rem;color:#6b7280;margin-bottom:4px">Imagens</p>
        <div>${imagensHtml}</div>
        <p style="font-size:.78rem;color:#9ca3af;margin-top:8px">
          <code>_id: ${escHtml(String(av._id))}</code><br>
          Atualizado: ${new Date(av.dataAtualizacao).toLocaleString('pt-BR')}
        </p>
      </div>
    </div>
  `;
  row.style.display = '';
}

// ── Moderar (Admin) ───────────────────────────────────────────────────────────

async function moderarStatus(id, status) {
  const res = await fetch(`/avaliacoes/${id}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ status }),
  });
  if (res.ok) { mostrarMensagem(`Status alterado para "${status}".`, 'ok'); carregar(paginaAtual); }
  else        { const d = await res.json(); mostrarMensagem(d.erro, 'err'); }
}

// ── Excluir ───────────────────────────────────────────────────────────────────

async function excluir(id) {
  if (!confirm('Excluir esta avaliação?')) return;
  const res = await fetch(`/avaliacoes/${id}`, { method: 'DELETE' });
  if (res.ok) { mostrarMensagem('Avaliação excluída.', 'ok'); carregar(paginaAtual); }
  else        { const d = await res.json(); mostrarMensagem(d.erro, 'err'); }
}

// ── Salvar (criar / atualizar) ────────────────────────────────────────────────

async function salvar(event) {
  event.preventDefault();
  const id        = document.getElementById('av-id').value;
  const produtoId = document.getElementById('av-produtoId').value;
  const nota      = getNota();
  const titulo    = document.getElementById('av-titulo').value.trim();
  const comentario = document.getElementById('av-comentario').value.trim();

  if (!produtoId)   return mostrarMensagem('Informe o ID do produto.', 'err');
  if (!nota)        return mostrarMensagem('Selecione uma nota (1-5 estrelas).', 'err');
  if (!titulo)      return mostrarMensagem('O título é obrigatório.', 'err');
  if (!comentario)  return mostrarMensagem('O comentário é obrigatório.', 'err');

  const body = {
    produtoId: parseInt(produtoId),
    nota,
    titulo,
    comentario,
    pros:    document.getElementById('av-pros').value,
    contras: document.getElementById('av-contras').value,
    tags:    document.getElementById('av-tags').value,
    imagens: document.getElementById('av-imagens').value,
  };

  const url    = id ? `/avaliacoes/${id}` : '/avaliacoes';
  const method = id ? 'PUT' : 'POST';

  const res = await fetch(url, {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });

  if (!res.ok) {
    const d = await res.json();
    return mostrarMensagem(d.erro || 'Erro ao salvar.', 'err');
  }

  mostrarMensagem(id ? 'Avaliação atualizada!' : 'Avaliação criada com status "pendente"!', 'ok');
  cancelar();
  carregar(paginaAtual);
}

// ── Editar ────────────────────────────────────────────────────────────────────

async function editarAvaliacao(id) {
  const res = await fetch(`/avaliacoes/${id}`);
  if (!res.ok) return;
  const av = await res.json();

  document.getElementById('av-id').value              = String(av._id);
  document.getElementById('av-produtoId').value       = av.produtoId;
  document.getElementById('av-titulo').value          = av.titulo;
  document.getElementById('av-comentario').value      = av.comentario;
  document.getElementById('av-pros').value            = (av.pros || []).join('\n');
  document.getElementById('av-contras').value         = (av.contras || []).join('\n');
  document.getElementById('av-tags').value            = (av.tags || []).join(', ');
  document.getElementById('av-imagens').value         = (av.imagens || []).join(', ');
  document.getElementById('form-titulo').textContent  = 'Editar Avaliação';
  document.getElementById('btn-cancelar').hidden      = false;
  setNota(av.nota);
  document.getElementById('form-avaliacao').scrollIntoView({ behavior: 'smooth' });
}

// ── Seed ──────────────────────────────────────────────────────────────────────

async function semearDados() {
  const res = await fetch('/avaliacoes/seed', { method: 'POST' });
  const d   = await res.json();
  mostrarMensagem(res.ok ? `${d.inseridos} avaliações de teste criadas!` : (d.erro || 'Erro'), res.ok ? 'ok' : 'err', 'msg-seed');
  if (res.ok) carregar();
}

// ── Cancelar ──────────────────────────────────────────────────────────────────

function cancelar() {
  document.getElementById('av-id').value         = '';
  document.getElementById('av-produtoId').value  = '';
  document.getElementById('av-titulo').value     = '';
  document.getElementById('av-comentario').value = '';
  document.getElementById('av-pros').value       = '';
  document.getElementById('av-contras').value    = '';
  document.getElementById('av-tags').value       = '';
  document.getElementById('av-imagens').value    = '';
  document.getElementById('form-titulo').textContent = 'Nova Avaliação';
  document.getElementById('btn-cancelar').hidden = true;
  setNota(0);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderEstrelas(nota) {
  return '★'.repeat(nota) + '<span class="stars-empty">' + '★'.repeat(5 - nota) + '</span>';
}

function mostrarMensagem(texto, tipo, elId = 'mensagem') {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = texto;
  el.className   = 'mensagem ' + tipo;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.className = 'mensagem'; }, 5000);
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
