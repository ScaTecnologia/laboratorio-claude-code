async function login(event) {
  event.preventDefault();

  const email = document.getElementById('email').value.trim();
  const senha = document.getElementById('senha').value;

  if (!email || !senha) return mostrarMensagem('Preencha e-mail e senha.', 'err');

  const res = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha }),
  });

  if (!res.ok) {
    const data = await res.json();
    return mostrarMensagem(data.erro || 'Erro ao fazer login.', 'err');
  }

  window.location.href = '/clientes.html';
}

function mostrarMensagem(texto, tipo) {
  const el = document.getElementById('mensagem');
  el.textContent = texto;
  el.className = 'mensagem ' + tipo;
}

// Se já estiver logado, redireciona direto
fetch('/me').then(r => { if (r.ok) window.location.href = '/clientes.html'; });
