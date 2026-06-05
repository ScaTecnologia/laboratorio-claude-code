const API = '/fornecedores';

(async () => {
  const usuario = await verificarAuth();
  if (!usuario) return;
  configurarHeader(usuario);
  carregar();
})();

async function carregar() {
  const res = await fetch(API);
  if (!res.ok) return;
  const lista = await res.json();
  const tbody = document.getElementById('tabela-body');

  if (lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="vazio">Nenhum fornecedor cadastrado.</td></tr>';
    return;
  }

  tbody.innerHTML = lista.map(f => `
    <tr>
      <td class="td-id">${f.id}</td>
      <td>${escHtml(f.nomeempresa)}</td>
      <td>${escHtml(f.nomefantasia || '—')}</td>
      <td>${escHtml(f.cnpj || '—')}</td>
      <td>${escHtml(f.cidade || '—')}</td>
      <td>${escHtml(f.telefone || '—')}</td>
      <td class="acoes">
        <button class="btn btn-sm btn-secondary" onclick="editar(${f.id})">Editar</button>
        <button class="btn btn-sm btn-danger"    onclick="deletar(${f.id})">Deletar</button>
      </td>
    </tr>
  `).join('');
}

async function salvar(event) {
  event.preventDefault();
  const id = document.getElementById('fornecedor-id').value;
  const nomeempresa = document.getElementById('nomeempresa').value.trim();

  if (!nomeempresa) return mostrarMensagem('Informe a Razão Social do fornecedor.', 'err');

  const body = {
    nomeempresa,
    nomefantasia: document.getElementById('nomefantasia').value.trim(),
    cnpj:         document.getElementById('cnpj').value.trim(),
    telefone:     document.getElementById('telefone').value.trim(),
    email:        document.getElementById('email').value.trim(),
    endereco:     document.getElementById('endereco').value.trim(),
    bairro:       document.getElementById('bairro').value.trim(),
    cidade:       document.getElementById('cidade').value.trim(),
    estado:       document.getElementById('estado').value.trim().toUpperCase(),
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

  mostrarMensagem(id ? 'Fornecedor atualizado!' : 'Fornecedor criado!', 'ok');
  cancelarEdicao();
  carregar();
}

async function editar(id) {
  const res = await fetch(`${API}/${id}`);
  if (!res.ok) return;
  const f = await res.json();

  document.getElementById('fornecedor-id').value         = f.id;
  document.getElementById('nomeempresa').value           = f.nomeempresa   || '';
  document.getElementById('nomefantasia').value          = f.nomefantasia  || '';
  document.getElementById('cnpj').value                  = f.cnpj         || '';
  document.getElementById('telefone').value              = f.telefone      || '';
  document.getElementById('email').value                 = f.email         || '';
  document.getElementById('endereco').value              = f.endereco      || '';
  document.getElementById('bairro').value                = f.bairro        || '';
  document.getElementById('cidade').value                = f.cidade        || '';
  document.getElementById('estado').value                = f.estado        || '';
  document.getElementById('form-titulo').textContent     = 'Editar Fornecedor';
  document.getElementById('btn-cancelar').hidden         = false;
  document.querySelector('.card').scrollIntoView({ behavior: 'smooth' });
}

async function deletar(id) {
  if (!confirm('Deseja remover este fornecedor? Esta ação não pode ser desfeita.')) return;
  const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
  if (!res.ok) return mostrarMensagem('Erro ao remover fornecedor.', 'err');
  carregar();
}

function cancelarEdicao() {
  ['fornecedor-id','nomeempresa','nomefantasia','cnpj','telefone','email','endereco','bairro','cidade','estado'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('form-titulo').textContent = 'Novo Fornecedor';
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
