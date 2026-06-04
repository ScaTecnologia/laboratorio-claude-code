async function verificarAuth(roleRequerido) {
  try {
    const res = await fetch('/me');
    if (!res.ok) { window.location.href = '/login.html'; return null; }
    const usuario = await res.json();
    if (roleRequerido && usuario.role !== roleRequerido) {
      window.location.href = '/clientes.html';
      return null;
    }
    return usuario;
  } catch {
    window.location.href = '/login.html';
    return null;
  }
}

function configurarHeader(usuario) {
  const nomeEl = document.getElementById('usuario-nome');
  if (nomeEl) nomeEl.textContent = usuario.nome;

  const badgeEl = document.getElementById('usuario-role');
  if (badgeEl) {
    badgeEl.textContent = usuario.role;
    badgeEl.className = `badge badge-${usuario.role.toLowerCase()}`;
  }

  if (usuario.role !== 'Admin') {
    document.querySelectorAll('[data-admin]').forEach(el => el.style.display = 'none');
  }
}

async function logout() {
  await fetch('/logout', { method: 'POST' });
  window.location.href = '/login.html';
}
