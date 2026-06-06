const eventoModule = require('../eventos');

function responder(res, status, dados) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(dados));
}

async function handle(req, res, sessao, partes) {
  if (!sessao) return responder(res, 401, { erro: 'Não autenticado' });

  if (req.method === 'GET' && partes[1] === 'black-friday')
    return responder(res, 200, await eventoModule.relatorioBlackFriday());

  return responder(res, 404, { erro: 'Relatório não encontrado' });
}

module.exports = { handle };
