let usuarioLogado = null;

(async () => {
  const usuario = await verificarAuth();
  if (!usuario) return;
  usuarioLogado = usuario;
  configurarHeader(usuario);

  if (usuario.role === 'Admin') {
    document.getElementById('card-atualizar').hidden  = false;
    document.getElementById('card-confirmar').hidden  = false;
    document.getElementById('col-acoes').hidden       = false;
  }

  await carregar();
})();

async function carregar() {
  const res = await fetch('/estoque');
  if (!res.ok) return;
  const lista = await res.json();

  const tbody = document.getElementById('tabela-body');

  // Popula os selects de produtos nos formulários
  const opts = lista.map(e => `<option value="${e.produto_id}">${escHtml(e.nome)}</option>`).join('');
  ['sel-produto-reserva','sel-produto-confirmar','sel-produto-atualizar'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts || '<option value="">Nenhum produto</option>';
  });

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="vazio">Nenhum produto com estoque cadastrado. Acesse <a href="/produtos.html">Produtos</a> para criar.</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(e => {
    const estCls  = e.quantidade === 0 ? 'est-zero' : e.quantidade <= 5 ? 'est-baixo' : 'est-alto';
    const dispCls = e.disponivel  === 0 ? 'est-zero' : e.disponivel  <= 5 ? 'est-baixo' : 'est-alto';
    const resCls  = e.reservado > 0 ? 'est-res' : '';
    const ttl     = e.reserva_ttl ? `<span class="ttl-chip">⏱ ${e.reserva_ttl}s</span>` : '—';

    const editBtn = usuarioLogado?.role === 'Admin'
      ? `<button class="btn btn-sm btn-secondary" onclick="preencherAtualizar(${e.produto_id}, ${e.quantidade})">Editar</button>`
      : '';

    return `<tr>
      <td class="td-id">${e.produto_id}</td>
      <td>${escHtml(e.nome)}</td>
      <td class="${estCls}">${e.quantidade}</td>
      <td class="${resCls}">${e.reservado > 0 ? `🔒 ${e.reservado}` : '0'}</td>
      <td class="${dispCls}">${e.disponivel}</td>
      <td>${ttl}</td>
      <td class="acoes">${editBtn}</td>
    </tr>`;
  }).join('');
}

function preencherAtualizar(produtoId, qtdAtual) {
  document.getElementById('sel-produto-atualizar').value = produtoId;
  document.getElementById('qtd-nova').value              = qtdAtual;
  document.getElementById('card-atualizar').scrollIntoView({ behavior: 'smooth' });
}

async function reservar() {
  const produtoId = parseInt(document.getElementById('sel-produto-reserva').value);
  const quantidade = parseInt(document.getElementById('qtd-reserva').value);

  if (!produtoId || quantidade <= 0) return mostrarMensagem('Selecione um produto e informe a quantidade.', 'err', 'msg-reserva');

  const res = await fetch(`/estoque/${produtoId}/reservar`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ quantidade }),
  });

  const data = await res.json();

  if (!res.ok) return mostrarMensagem(data.erro, 'err', 'msg-reserva');

  mostrarMensagem(
    `Reserva criada! Total reservado: ${data.totalReservado} | Expira em: ${data.ttl}s`,
    'ok', 'msg-reserva'
  );
  carregar();
}

async function liberarReserva() {
  const produtoId  = parseInt(document.getElementById('sel-produto-reserva').value);
  const quantidade = parseInt(document.getElementById('qtd-reserva').value);

  if (!produtoId) return mostrarMensagem('Selecione um produto.', 'err', 'msg-reserva');

  const res = await fetch(`/estoque/${produtoId}/reserva?quantidade=${quantidade || 0}`, {
    method: 'DELETE',
  });

  const data = await res.json();
  mostrarMensagem(`Reserva liberada. Reservado restante: ${data.reservado}`, 'ok', 'msg-reserva');
  carregar();
}

async function confirmarVenda() {
  const produtoId  = parseInt(document.getElementById('sel-produto-confirmar').value);
  const quantidade = parseInt(document.getElementById('qtd-confirmar').value);

  if (!produtoId || quantidade <= 0) return mostrarMensagem('Informe produto e quantidade.', 'err', 'msg-confirmar');

  const res = await fetch(`/estoque/${produtoId}/confirmar`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ quantidade }),
  });

  const data = await res.json();
  if (!res.ok) return mostrarMensagem(data.erro, 'err', 'msg-confirmar');

  mostrarMensagem('Venda confirmada! Estoque debitado no banco e reserva removida do Redis.', 'ok', 'msg-confirmar');
  carregar();
}

async function atualizarEstoque() {
  const produtoId  = parseInt(document.getElementById('sel-produto-atualizar').value);
  const quantidade = parseInt(document.getElementById('qtd-nova').value);

  if (!produtoId || quantidade < 0) return mostrarMensagem('Informe produto e quantidade válida.', 'err', 'msg-atualizar');

  const res = await fetch(`/estoque/${produtoId}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ quantidade }),
  });

  if (!res.ok) return mostrarMensagem('Erro ao atualizar estoque.', 'err', 'msg-atualizar');

  mostrarMensagem(`Estoque atualizado para ${quantidade} unidade(s). Cache invalidado.`, 'ok', 'msg-atualizar');
  carregar();
}

function mostrarMensagem(texto, tipo, elId = 'msg-estoque') {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = texto;
  el.className   = 'mensagem ' + tipo;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.className = 'mensagem'; }, 6000);
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
