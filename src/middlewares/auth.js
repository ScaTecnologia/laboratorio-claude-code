const sessoes = require('../sessoes');

function parseCookies(req) {
  const cookies = {};
  (req.headers.cookie || '').split(';').forEach(part => {
    const [name, ...rest] = part.trim().split('=');
    if (name) cookies[name.trim()] = rest.join('=').trim();
  });
  return cookies;
}

function getSessao(req) {
  return sessoes.buscar(parseCookies(req).sessao_id);
}

function setCookie(res, name, value, opts = {}) {
  let cookie = `${name}=${value}; HttpOnly; Path=/`;
  if (opts.maxAge !== undefined) cookie += `; Max-Age=${opts.maxAge}`;
  res.setHeader('Set-Cookie', cookie);
}

module.exports = { parseCookies, getSessao, setCookie };
