const API = '/usuarios';

(async () => {
  const usuario = await verificarAuth('Admin');
  if (!usuario) return;
  configurarHeader(usuario);
  carregar();
})();

async function carregar() {
  const res = await fetch(API);
  if (!res.ok) return;
  const usuarios = await res.json();
  const tbody = document.getElementById('tabela-body');

  if (usuarios.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="vazio">Nenhum usuário cadastrado.</td></tr>';
    return;
  }

  tbody.innerHTML = usuarios.map(u => `
    <tr>
      <td class="td-id">${u.id}</td>
      <td>${escHtml(u.nome)}</td>
      <td>${escHtml(u.email)}</td>
      <td><span class="badge badge-${u.role.toLowerCase()}">${u.role}</span></td>
      <td class="acoes">
        <button class="btn btn-sm btn-secondary" onclick="editar(${u.id}, '${escAttr(u.nome)}', '${escAttr(u.email)}', '${escAttr(u.role)}')">Editar</button>
        ${u.id !== 1 ? `<button class="btn btn-sm btn-danger" onclick="deletar(${u.id})">Deletar</button>` : ''}
      </td>
    </tr>
  `).join('');
}

async function salvar(event) {
  event.preventDefault();
  const id    = document.getElementById('usuario-id').value;
  const nome  = document.getElementById('nome').value.trim();
  const email = document.getElementById('email').value.trim();
  const senha = document.getElementById('senha').value;
  const role  = document.getElementById('role').value;

  if (!nome)        return mostrarMensagem('Informe o nome.', 'err');
  if (!email)       return mostrarMensagem('Informe o e-mail.', 'err');
  if (!id && !senha) return mostrarMensagem('Informe a senha.', 'err');

  const body = { nome, email, role };
  if (senha) body.senha = senha;

  const res = await fetch(id ? `${API}/${id}` : API, {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json();
    return mostrarMensagem(data.erro || 'Erro ao salvar.', 'err');
  }

  mostrarMensagem(id ? 'Usuário atualizado!' : 'Usuário criado!', 'ok');
  cancelarEdicao();
  carregar();
}

async function deletar(id) {
  if (!confirm('Deseja remover este usuário? Esta ação não pode ser desfeita.')) return;
  const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json();
    return mostrarMensagem(data.erro || 'Erro ao remover.', 'err');
  }
  carregar();
}

function editar(id, nome, email, role) {
  document.getElementById('usuario-id').value        = id;
  document.getElementById('nome').value              = nome;
  document.getElementById('email').value             = email;
  document.getElementById('role').value              = role;
  document.getElementById('senha').value             = '';
  document.getElementById('senha').placeholder       = 'Deixe em branco para manter a senha atual';
  document.getElementById('form-titulo').textContent = 'Editar Usuário';
  document.getElementById('btn-cancelar').hidden     = false;
  document.querySelector('.card').scrollIntoView({ behavior: 'smooth' });
}

function cancelarEdicao() {
  document.getElementById('usuario-id').value        = '';
  document.getElementById('nome').value              = '';
  document.getElementById('email').value             = '';
  document.getElementById('senha').value             = '';
  document.getElementById('senha').placeholder       = '••••••••';
  document.getElementById('role').value              = 'Atendente';
  document.getElementById('form-titulo').textContent = 'Novo Usuário';
  document.getElementById('btn-cancelar').hidden     = true;
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

function escAttr(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
