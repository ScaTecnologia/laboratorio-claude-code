// ============================================================================
// clientes.js (frontend) — Lógica da tela de CRUD de Clientes no navegador.
// Roda no browser (clientes.html), conversa com a API em /clientes via Fetch.
// Depende de funções globais definidas em outros scripts da página:
//   verificarAuth() e configurarHeader() (autenticação/cabeçalho).
// ============================================================================

// Endpoint base da API de clientes (todas as chamadas partem daqui).
const API = '/clientes';

// IIFE de inicialização: executa assim que o script é carregado.
// Garante que o usuário está autenticado ANTES de montar a tela.
(async () => {
  const usuario = await verificarAuth();   // valida sessão no servidor
  if (!usuario) return;                     // sem sessão: aborta (redirect é tratado por verificarAuth)
  configurarHeader(usuario);                // preenche o cabeçalho com dados do usuário
  carregar();                               // busca e renderiza a lista de clientes
})();

// Busca a lista de clientes na API e renderiza a tabela.
async function carregar() {
  const res = await fetch(API);
  if (!res.ok) return;                      // erro na requisição: mantém tela como está
  const clientes = await res.json();
  const numbersClientes = document.getElementById('numberSpan');
  numbersClientes.textContent = clientes.length;
  const tbody = document.getElementById('tabela-body');

  // Estado vazio: mostra uma linha de aviso ocupando todas as colunas.
  if (clientes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="vazio">Nenhum cliente cadastrado.</td></tr>';
    return;
  }

  // Monta uma <tr> por cliente. escHtml() evita XSS ao interpolar dados do banco.
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

// Cria (POST) ou atualiza (PUT) um cliente. Chamada no submit do formulário.
async function salvar(event) {
  event.preventDefault();                              // impede o reload padrão do form
  const id = document.getElementById('cliente-id').value;  // vazio = criar; preenchido = editar
  const nome = document.getElementById('nome').value.trim();

  // Validação mínima no cliente (o servidor também valida).
  if (!nome) return mostrarMensagem('Informe o nome do cliente.', 'err');

  // Coleta os campos do formulário no formato esperado pela API.
  const body = {
    nome,
    endereco: document.getElementById('endereco').value.trim(),
    bairro:   document.getElementById('bairro').value.trim(),
    cidade:   document.getElementById('cidade').value.trim(),
    estado:   document.getElementById('estado').value.trim().toUpperCase(),  // UF sempre em maiúsculas
    email:    document.getElementById('email').value.trim(),
    telefone: document.getElementById('telefone').value.trim(),
  };

  // A URL e o método mudam conforme seja criação (POST /clientes) ou edição (PUT /clientes/:id).
  const res = await fetch(id ? `${API}/${id}` : API, {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  // Em caso de erro, mostra a mensagem devolvida pela API (ou um texto padrão).
  if (!res.ok) {
    const data = await res.json();
    return mostrarMensagem(data.erro || 'Erro ao salvar.', 'err');
  }

  mostrarMensagem(id ? 'Cliente atualizado!' : 'Cliente criado!', 'ok');
  cancelarEdicao();   // limpa o formulário e volta ao modo "Novo"
  carregar();         // recarrega a tabela com os dados atualizados
}

// Carrega os dados de um cliente no formulário para edição.
async function editar(id) {
  const res = await fetch(`${API}/${id}`);
  if (!res.ok) return;
  const c = await res.json();

  // Preenche cada campo do formulário (|| '' evita "undefined" quando o campo é nulo).
  document.getElementById('cliente-id').value        = c.id;
  document.getElementById('nome').value              = c.nome      || '';
  document.getElementById('endereco').value          = c.endereco  || '';
  document.getElementById('bairro').value            = c.bairro    || '';
  document.getElementById('cidade').value            = c.cidade    || '';
  document.getElementById('estado').value            = c.estado    || '';
  document.getElementById('email').value             = c.email     || '';
  document.getElementById('telefone').value          = c.telefone  || '';
  document.getElementById('form-titulo').textContent = 'Editar Cliente';   // muda o título do form
  document.getElementById('btn-cancelar').hidden     = false;              // exibe o botão "Cancelar"
  document.querySelector('.card').scrollIntoView({ behavior: 'smooth' });  // rola até o formulário
}

// Remove um cliente após confirmação do usuário.
async function deletar(id) {
  if (!confirm('Deseja remover este cliente? Esta ação não pode ser desfeita.')) return;
  const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
  if (!res.ok) return mostrarMensagem('Erro ao remover cliente.', 'err');
  carregar();   // atualiza a tabela após a remoção
}

// Limpa o formulário e o devolve ao estado de criação ("Novo Cliente").
function cancelarEdicao() {
  ['cliente-id','nome','endereco','bairro','cidade','estado','email','telefone'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('form-titulo').textContent = 'Novo Cliente';
  document.getElementById('btn-cancelar').hidden = true;
}

// Exibe uma mensagem temporária (sucesso/erro) que some automaticamente após 4s.
// tipo: 'ok' (sucesso) ou 'err' (erro) — controla a classe CSS.
function mostrarMensagem(texto, tipo) {
  const el = document.getElementById('mensagem');
  el.textContent = texto;
  el.className = 'mensagem ' + tipo;
  clearTimeout(el._timer);                                        // cancela timer anterior (evita sumiço precoce)
  el._timer = setTimeout(() => { el.className = 'mensagem'; }, 4000);
}

// Escapa caracteres especiais de HTML para prevenir XSS ao inserir dados na tabela.
function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
