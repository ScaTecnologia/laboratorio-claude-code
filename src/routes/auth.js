const usuariosModule = require('../usuarios');
const sessoes        = require('../sessoes');
const { parseCookies, setCookie } = require('../middlewares/auth');

function lerBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch { resolve({}); } });
  });
}

function responder(res, status, dados) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(dados));
}

async function login(req, res) {
  const { email, senha } = await lerBody(req);
  if (!email || !senha) return responder(res, 400, { erro: 'E-mail e senha são obrigatórios' });
  const usuario = await usuariosModule.buscarPorEmail(email);
  if (!usuario) return responder(res, 401, { erro: 'Credenciais inválidas' });
  const ok = await usuariosModule.verificarSenha(senha, usuario.senha);
  if (!ok) return responder(res, 401, { erro: 'Credenciais inválidas' });
  const sessaoId = await sessoes.criar({ userId: usuario.id, role: usuario.role, nome: usuario.nome });
  setCookie(res, 'sessao_id', sessaoId, { maxAge: 86400 * 7 });
  return responder(res, 200, { id: usuario.id, nome: usuario.nome, role: usuario.role });
}

async function logout(req, res) {
  const { sessao_id } = parseCookies(req);
  if (sessao_id) await sessoes.encerrar(sessao_id);
  setCookie(res, 'sessao_id', '', { maxAge: 0 });
  return responder(res, 200, { mensagem: 'Sessão encerrada' });
}

function me(req, res, sessao) {
  if (!sessao) return responder(res, 401, { erro: 'Não autenticado' });
  return responder(res, 200, { id: sessao.userId, nome: sessao.nome, role: sessao.role });
}

module.exports = { login, logout, me };
