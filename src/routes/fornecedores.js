const http = require('http');

function responder(res, status, dados) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(dados));
}

function proxyParaPython(req, res) {
  return new Promise(resolve => {
    const options = { hostname: 'localhost', port: 3001, path: req.url, method: req.method,
                      headers: { 'Content-Type': 'application/json' } };
    const proxyReq = http.request(options, proxyRes => {
      res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
      proxyRes.pipe(res, { end: true });
      resolve();
    });
    proxyReq.on('error', () => {
      responder(res, 502, { erro: 'Serviço de fornecedores indisponível. Inicie: python src/fornecedores_api.py' });
      resolve();
    });
    req.pipe(proxyReq, { end: true });
  });
}

async function handle(req, res, sessao) {
  if (!sessao) return responder(res, 401, { erro: 'Não autenticado' });
  return proxyParaPython(req, res);
}

module.exports = { handle };
