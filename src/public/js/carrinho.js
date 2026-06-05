let ttlInterval = null;

(async () => {
  const usuario = await verificarAuth();
  if (!usuario) return;
  configurarHeader(usuario);

  await carregarProdutos();
  await carregarCarrinho();
})();

async function carregarProdutos() {
  const res = await fetch('/produtos');
  if (!res.ok) return;
  const resultado = await res.json();
  const sel = document.getElementById('sel-produto');
  const lista = resultado.dados || [];

  sel.innerHTML = '<option value="">— Selecione um produto —</option>' +
    lista.filter(p => p.ativo && parseInt(p.estoque) > 0).map(p =>
      `<option value="${p.id}">${escHtml(p.nome)} — R$ ${parseFloat(p.preco).toFixed(2)} (${p.estoque} em estoque)</option>`
    ).join('');
}

async function carregarCarrinho() {
  const res = await fetch('/carrinho');
  if (!res.ok) return;
  const carrinho = await res.json();
  renderizarCarrinho(carrinho);
}

function renderizarCarrinho(carrinho) {
  const tbody   = document.getElementById('cart-body');
  const totalEl = document.getElementById('cart-total');
  const acoesEl = document.getElementById('cart-acoes');
  const ttlEl   = document.getElementById('cart-ttl-badge');

  if (ttlInterval) clearInterval(ttlInterval);

  if (!carrinho.itens || carrinho.itens.length === 0) {
    tbody.innerHTML   = '<tr><td colspan="5" class="vazio">Carrinho vazio. Adicione produtos acima.</td></tr>';
    totalEl.style.display = 'none';
    acoesEl.style.display = 'none';
    ttlEl.textContent = '';
    return;
  }

  tbody.innerHTML = carrinho.itens.map(item => `
    <tr>
      <td>${escHtml(item.nome)}</td>
      <td>R$ ${item.preco.toFixed(2)}</td>
      <td>
        <input type="number" min="1" value="${item.quantidade}"
          style="width:70px"
          onchange="atualizarQuantidade(${item.produto_id}, this.value)" />
      </td>
      <td>R$ ${item.subtotal.toFixed(2)}</td>
      <td class="acoes">
        <button class="btn btn-sm btn-danger" onclick="removerItem(${item.produto_id})">Remover</button>
      </td>
    </tr>
  `).join('');

  totalEl.textContent   = `Total: R$ ${carrinho.total.toFixed(2)}`;
  totalEl.style.display = 'block';
  acoesEl.style.display = 'flex';

  // Contador TTL do carrinho
  if (carrinho.ttl) {
    let ttlRestante = carrinho.ttl;
    const atualizar = () => {
      const min = Math.floor(ttlRestante / 60);
      const seg = ttlRestante % 60;
      ttlEl.textContent = `⏱ Carrinho expira em: ${min}:${String(seg).padStart(2,'0')}`;
      if (ttlRestante <= 0) {
        clearInterval(ttlInterval);
        ttlEl.textContent = '⚠️ Carrinho expirado!';
      }
      ttlRestante--;
    };
    atualizar();
    ttlInterval = setInterval(atualizar, 1000);
  }
}

async function adicionarItem() {
  const produtoId  = parseInt(document.getElementById('sel-produto').value);
  const quantidade = parseInt(document.getElementById('qtd-item').value);

  if (!produtoId) return mostrarMensagem('Selecione um produto.', 'err', 'msg-add');
  if (quantidade <= 0) return mostrarMensagem('Quantidade deve ser maior que zero.', 'err', 'msg-add');

  const res = await fetch('/carrinho/itens', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ produtoId, quantidade }),
  });

  if (!res.ok) {
    const data = await res.json();
    return mostrarMensagem(data.erro || 'Erro ao adicionar item.', 'err', 'msg-add');
  }

  const carrinho = await res.json();
  renderizarCarrinho(carrinho);
  mostrarMensagem('Item adicionado! TTL do carrinho renovado.', 'ok', 'msg-add');
}

async function atualizarQuantidade(produtoId, quantidade) {
  quantidade = parseInt(quantidade);
  if (quantidade <= 0) return removerItem(produtoId);

  const res = await fetch(`/carrinho/itens/${produtoId}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ quantidade }),
  });

  if (res.ok) {
    const carrinho = await res.json();
    renderizarCarrinho(carrinho);
  }
}

async function removerItem(produtoId) {
  const res = await fetch(`/carrinho/itens/${produtoId}`, { method: 'DELETE' });
  if (res.ok) {
    const carrinho = await res.json();
    renderizarCarrinho(carrinho);
  }
}

async function limparCarrinho() {
  if (!confirm('Limpar todos os itens do carrinho?')) return;
  await fetch('/carrinho', { method: 'DELETE' });
  renderizarCarrinho({ itens: [], total: 0, ttl: null });
  mostrarMensagem('Carrinho limpo.', 'ok', 'msg-cart');
}

async function checkout() {
  const res = await fetch('/carrinho/checkout', { method: 'POST' });
  const data = await res.json();

  if (!res.ok) {
    return mostrarMensagem(data.erro || 'Erro no checkout.', 'err', 'msg-cart');
  }

  // Mostra o resultado do checkout
  const card   = document.getElementById('card-checkout');
  const result = document.getElementById('checkout-result');

  card.hidden = false;
  result.innerHTML = `
    <h3>✅ ${data.mensagem}</h3>
    <p><strong>Itens reservados:</strong></p>
    <ul>
      ${data.itens.map(i => `<li>${escHtml(i.nome)} — ${i.quantidade} unidade(s) × R$ ${i.preco.toFixed(2)} = R$ ${i.subtotal.toFixed(2)}</li>`).join('')}
    </ul>
    <p><strong>Total:</strong> R$ ${data.total.toFixed(2)}</p>
    <p style="color:#8b5cf6;font-size:.88rem">
      ⏱ As reservas no Redis expiram em <strong>${data.ttl / 60} minutos</strong>.
      Se o pagamento não for concluído, o estoque é liberado automaticamente.
    </p>
  `;

  // Limpa o carrinho da tela (já foi limpo no backend)
  renderizarCarrinho({ itens: [], total: 0, ttl: null });
  card.scrollIntoView({ behavior: 'smooth' });
}

function mostrarMensagem(texto, tipo, elId = 'msg-cart') {
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
