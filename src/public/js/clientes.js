const API = '/clientes';

(async () => {
  const usuario = await verificarAuth();
  if (!usuario) return;
  configurarHeader(usuario);
  carregar();
})();

async function carregar() {
  const res = await fetch(API);
  if (!res.ok) return;
  const clientes = await res.json();
  const tbody = document.getElementById('tabela-body');

  if (clientes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="vazio">Nenhum cliente cadastrado.</td></tr>';
    return;
  }

  tbody.innerHTML = clientes.map(c => `
    <tr>
      <td class="td-id">${c.id}</td>
      <td>${escHtml(c.nome)}</td>
      <td>${escHtml(c.cidade || '—')}</td>
      <td>${escHtml(c.email || '—')}</td>
      <td>${escHtml(c.telefone || '—')}</td>
      <td class="acoes">
        <button class="btn btn-sm btn-secondary" onclick="editar(${c.id})">Editar</button>
        <button class="btn btn-sm btn-danger"    onclick="deletar(${c.id})">Deletar</button>
      </td>
    </tr>
  `).join('');
}

async function salvar(event) {
  event.preventDefault();
  const id = document.getElementById('cliente-id').value;
  const nome = document.getElementById('nome').value.trim();

  if (!nome) return mostrarMensagem('Informe o nome do cliente.', 'err');

  const body = {
    nome,
    endereco: document.getElementById('endereco').value.trim(),
    bairro:   document.getElementById('bairro').value.trim(),
    cidade:   document.getElementById('cidade').value.trim(),
    estado:   document.getElementById('estado').value.trim().toUpperCase(),
    email:    document.getElementById('email').value.trim(),
    telefone: document.getElementById('telefone').value.trim(),
  };

  const res = await fetch(id ? `${API}/${id}` : API, {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json();
    return mostrarMensagem(data.erro || 'Erro ao salvar.', 'err');
  }

  mostrarMensagem(id ? 'Cliente atualizado!' : 'Cliente criado!', 'ok');
  cancelarEdicao();
  carregar();
}

async function editar(id) {
  const res = await fetch(`${API}/${id}`);
  if (!res.ok) return;
  const c = await res.json();

  document.getElementById('cliente-id').value        = c.id;
  document.getElementById('nome').value              = c.nome      || '';
  document.getElementById('endereco').value          = c.endereco  || '';
  document.getElementById('bairro').value            = c.bairro    || '';
  document.getElementById('cidade').value            = c.cidade    || '';
  document.getElementById('estado').value            = c.estado    || '';
  document.getElementById('email').value             = c.email     || '';
  document.getElementById('telefone').value          = c.telefone  || '';
  document.getElementById('form-titulo').textContent = 'Editar Cliente';
  document.getElementById('btn-cancelar').hidden     = false;
  document.querySelector('.card').scrollIntoView({ behavior: 'smooth' });
}

async function deletar(id) {
  if (!confirm('Deseja remover este cliente? Esta ação não pode ser desfeita.')) return;
  const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
  if (!res.ok) return mostrarMensagem('Erro ao remover cliente.', 'err');
  carregar();
}

function cancelarEdicao() {
  ['cliente-id','nome','endereco','bairro','cidade','estado','email','telefone'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('form-titulo').textContent = 'Novo Cliente';
  document.getElementById('btn-cancelar').hidden = true;
}

function mostrarMensagem(texto, tipo) {
  const el = document.getElementById('mensagem');
  el.textContent = texto;
  el.className = 'mensagem ' + tipo;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.className = 'mensagem'; }, 4000);
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
