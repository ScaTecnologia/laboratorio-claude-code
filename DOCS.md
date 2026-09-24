# Documentação Técnica — LabSystem

## Visão Geral

Aplicação web full-stack para gestão comercial. Expõe uma API REST para gerenciamento de **Usuários**, **Clientes** e **Fornecedores**, com autenticação por sessão, controle de acesso por perfil e interface web completa para uso via navegador.

O backend de Fornecedores roda em **Python (Flask)** na porta 3001. O servidor Node.js atua como gateway: valida a sessão e faz proxy das requisições para o serviço Python.

---

## Stack Tecnológica

| Camada           | Tecnologia                          |
|------------------|-------------------------------------|
| Runtime principal | Node.js **24 LTS** (CommonJS)      |
| Servidor HTTP    | `http` (módulo nativo do Node.js)   |
| API Fornecedores | Python **3.13** + Flask 3.1         |
| Banco de dados   | PostgreSQL 16 (porta 5151)          |
| Driver DB Node   | `pg` (node-postgres)                |
| Driver DB Python | `psycopg2-binary`                   |
| Redis / MongoDB  | Adaptadores **em memória** (`src/redis.js`, `src/mongo.js`) — sem servidor externo |
| Frontend         | HTML + CSS + JavaScript puro        |
| API Docs         | Swagger UI (via CDN)                |
| Containers       | Docker + Docker Compose (Postgres + Node + Python) |
| CI/CD            | GitHub Actions (`ci.yml`, `docker-build.yml`), CodeQL, Dependabot |
| Qualidade        | ESLint 10 (`eslint.config.js`), flake8, pytest, bandit, pip-audit, Trivy |

---

## Arquitetura

```
Navegador
    │
    ├── fetch('/me', '/login', '/logout')         Auth
    ├── fetch('/usuarios/*')                      CRUD Usuários
    ├── fetch('/clientes/*')                      CRUD Clientes
    └── fetch('/fornecedores/*')                  CRUD Fornecedores
                │
                ▼
        src/server.js  :3000          ← Roteamento, auth middleware, proxy
                │
                ├── src/sessoes.js   ← Sessões (tabela sessoes no PostgreSQL)
                ├── src/usuarios.js  ← CRUD + hash de senha
                ├── src/clientes.js  ← CRUD clientes
                ├── src/db.js        ← Pool de conexões PostgreSQL
                │
                └── proxy HTTP ──▶  src/fornecedores_api.py  :3001
                                            │
                                    PostgreSQL :5151
                                    banco: laboratorio
                                    tabelas: usuarios, clientes, fornecedores
```

---

## Estrutura de Arquivos

```
laboratorio-claude-code/
├── src/
│   ├── server.js               ← Ponto de entrada Node.js (roteia para routes/)
│   ├── routes/                 ← Um handler por recurso: auth, usuarios, clientes,
│   │                             fornecedores (proxy → Python), produtos, estoque,
│   │                             carrinho, avaliacoes, eventos, relatorio
│   ├── middlewares/auth.js     ← Sessão por cookie (getSessao, setCookie, parseCookies)
│   ├── models/avaliacao.js     ← Validação/montagem de documentos de avaliação
│   ├── usuarios.js             ← CRUD usuários + hash de senha
│   ├── clientes.js             ← CRUD clientes (limite padrão 100, ordem por nome)
│   ├── produtos.js, estoque.js, carrinho.js, avaliacoes.js, eventos.js
│   ├── sessoes.js              ← Sessões persistidas no PostgreSQL
│   ├── db.js                   ← Pool PostgreSQL (host/porta por variável de ambiente)
│   ├── redis.js, mongo.js      ← Adaptadores em memória (interface de ioredis/mongodb)
│   ├── fornecedores_api.py     ← API Python Flask (porta 3001)
│   ├── soma.js, soma.test.js   ← Exemplo de função + teste
│   ├── usuarios.test.js, teste_*.js ← Testes (unitários e de integração)
│   ├── index.js                ← Arquivo de exploração inicial (não usado)
│   └── public/                 ← Páginas HTML, css/styles.css, js/<página>.js, swagger
├── tests/                      ← Testes Python (pytest): test_fornecedores_api.py, conftest.py
├── docs/                       ← Documentação (ver tabela no CLAUDE.md); .md é a fonte, .docx é gerado
├── .github/
│   ├── workflows/ci.yml        ← Esteira CI: lint, testes, segurança
│   ├── workflows/docker-build.yml ← Build + scan das imagens; publish/deploy manuais
│   ├── dependabot.yml          ← Atualização semanal de dependências
│   ├── ISSUE_TEMPLATE/         ← Modelos de card: tarefa, bug
│   └── pull_request_template.md
├── .claude/                    ← Skills, agentes e hooks do Claude Code
├── Dockerfile                  ← Imagem do Node
├── Dockerfile.python           ← Imagem da API Python
├── docker-compose.yml          ← Sobe Postgres + Node + Python
├── eslint.config.js            ← Regras de lint JS
├── .flake8                     ← Regras de lint Python
├── CODEOWNERS                  ← Revisor obrigatório por área (@ScaTecnologia)
├── DOCS.md                     ← Este arquivo
├── CLAUDE.md                   ← Instruções do projeto para o Claude Code
├── package.json                ← Dependências Node.js
├── requirements.txt            ← Dependências Python (runtime)
└── requirements-dev.txt        ← Dependências Python de desenvolvimento/CI
```

---

## Descrição de Cada Arquivo

### `src/server.js`
Ponto de entrada da aplicação Node.js. Cria o servidor HTTP na porta 3000 e centraliza todo o roteamento.

**Responsabilidades:**
- Servir as páginas HTML estáticas (`/`, `/login.html`, `/clientes.html`, `/fornecedores.html`, `/usuarios.html`, `/api-docs`)
- Processar as rotas de autenticação (`/login`, `/logout`, `/me`)
- Validar sessão e role antes de qualquer operação protegida
- Delegar operações de usuários e clientes para os módulos correspondentes
- Fazer **proxy autenticado** das rotas `/fornecedores/*` para o servidor Python na porta 3001
- Servir arquivos estáticos de `src/public/` com proteção contra path traversal

**Helpers internos:**

| Função | O que faz |
|--------|-----------|
| `lerBody(req)` | Lê e parseia o JSON do body da requisição |
| `responder(res, status, dados)` | Serializa e envia resposta JSON |
| `parseCookies(req)` | Extrai cookies do header `Cookie` |
| `getSessao(req)` | Lê `sessao_id` do cookie e busca a sessão na tabela `sessoes` |
| `setCookie(res, name, value, opts)` | Define header `Set-Cookie` com `HttpOnly` |
| `servirArquivo(res, filePath)` | Serve arquivo estático com Content-Type correto |
| `proxyParaPython(req, res)` | Encaminha a requisição (com body) para `localhost:3001` |

**Rotas:**

| Método | Rota                  | Auth        | Descrição                            |
|--------|-----------------------|-------------|--------------------------------------|
| GET    | `/`                   | Livre       | Landing page comercial               |
| GET    | `/login.html`         | Livre       | Tela de login                        |
| GET    | `/fornecedores.html`  | Livre       | Página CRUD fornecedores             |
| GET    | `/api-docs`           | Livre       | Swagger UI                           |
| POST   | `/login`              | Livre       | Autentica e cria sessão              |
| POST   | `/logout`             | Livre       | Encerra sessão e limpa cookie        |
| GET    | `/me`                 | Sessão      | Retorna usuário da sessão ativa      |
| GET    | `/usuarios`           | Admin       | Lista usuários                       |
| GET    | `/usuarios/:id`       | Admin       | Busca usuário por ID                 |
| POST   | `/usuarios`           | Admin       | Cria usuário                         |
| PUT    | `/usuarios/:id`       | Admin       | Atualiza usuário                     |
| DELETE | `/usuarios/:id`       | Admin       | Remove usuário (id=1 protegido)      |
| GET    | `/clientes`           | Sessão      | Lista clientes                       |
| GET    | `/clientes/:id`       | Sessão      | Busca cliente por ID                 |
| POST   | `/clientes`           | Sessão      | Cria cliente                         |
| PUT    | `/clientes/:id`       | Sessão      | Atualiza cliente                     |
| DELETE | `/clientes/:id`       | Sessão      | Remove cliente                       |
| *      | `/fornecedores/*`     | Sessão      | Proxy para API Python (:3001)        |
| GET    | `/css/*`, `/js/*` ... | Livre       | Arquivos estáticos de `src/public/` |

---

### `src/usuarios.js`
Módulo de negócio para gerenciamento de usuários. Toda operação retorna objetos sem o campo `senha`.

**Funções exportadas:**

| Função | Descrição |
|--------|-----------|
| `hashSenha(senha)` | Gera hash `salt:key` via `crypto.scrypt` (64 bytes, salt 16 bytes) |
| `verificarSenha(senha, hash)` | Compara senha informada com o hash armazenado |
| `inicializar()` | Cria tabela, aplica migrações de schema e garante que id=1 seja Admin |
| `criar(nome, email, senha, role)` | Insere usuário com senha hasheada |
| `listar()` | Retorna todos os usuários sem o campo `senha` |
| `buscar(id)` | Retorna usuário por ID sem `senha`, ou `null` |
| `buscarPorEmail(email)` | Retorna usuário **com** `senha` — usado exclusivamente no login |
| `atualizar(id, dados)` | Atualiza campos fornecidos; re-hasheia senha se incluída |
| `deletar(id)` | Remove usuário, retorna `true` ou `false` |

> `senha` nunca é retornada nas funções de leitura pública. Somente `buscarPorEmail` a inclui, e exclusivamente para verificação no login.

---

### `src/clientes.js`
Módulo de negócio para o CRUD de clientes. Segue o mesmo padrão de `usuarios.js`.

**Funções exportadas:**

| Função | Descrição |
|--------|-----------|
| `inicializar()` | Cria a tabela `clientes` se não existir |
| `criar(dados)` | Insere novo cliente e retorna o registro |
| `listar()` | Retorna todos os clientes ordenados por ID |
| `buscar(id)` | Retorna cliente por ID ou `null` |
| `atualizar(id, dados)` | Atualiza apenas os campos fornecidos |
| `deletar(id)` | Remove o cliente, retorna `true` ou `false` |

---

### `src/sessoes.js`
Gerencia sessões de usuário na tabela `sessoes` do PostgreSQL (`id`, `dados` em JSON, `criado_em`). As sessões **sobrevivem a reinicializações** do servidor e valem por **7 dias**.

**Funções exportadas:**

| Função | Descrição |
|--------|-----------|
| `inicializar()` | Cria a tabela `sessoes` se não existir e apaga sessões com mais de 7 dias |
| `criar(dados)` | Gera token aleatório (32 bytes → 64 caracteres hex), grava `{ userId, role, nome }` e retorna o token |
| `buscar(id)` | Retorna os dados da sessão pelo token (se tiver menos de 7 dias) ou `null` |
| `encerrar(id)` | Apaga a sessão (logout) |

---

### `src/db.js`
Configura a conexão com o PostgreSQL via `pg`.

- **`garantirBanco()`**: conecta no banco `postgres` (admin) e cria o banco `laboratorio` se não existir.
- **`pool`**: Pool de conexões exportado para uso em todos os módulos de negócio. Configuração padrão de 10 conexões simultâneas.

**Configuração:**

| Parâmetro | Valor         | Variável de ambiente |
|-----------|---------------|----------------------|
| Host      | `localhost`   | `DB_HOST` (no compose: `postgres`) |
| Porta     | `5151`        | `DB_PORT` (no compose: `5432`) |
| Usuário   | `postgres`    | — |
| Senha     | `5151`        | — |
| Banco     | `laboratorio` | — |

Os padrões valem para rodar sem Docker; dentro do container, `localhost` seria o próprio container, por isso o compose define `DB_HOST=postgres` (nome do serviço).

---

### `src/fornecedores_api.py`
API REST em **Python Flask** para o CRUD de Fornecedores. Roda na porta **3001** e se conecta diretamente ao PostgreSQL. É iniciada separadamente do servidor Node.js.

**Responsabilidades:**
- Criar a tabela `fornecedores` na inicialização se não existir
- Expor 5 rotas REST para o CRUD completo
- Retornar JSON em todas as respostas

**Rotas (porta 3001 — acessadas via proxy do Node.js):**

| Método | Rota                    | Descrição                        |
|--------|-------------------------|----------------------------------|
| GET    | `/fornecedores`         | Lista todos os fornecedores      |
| GET    | `/fornecedores/<id>`    | Busca fornecedor por ID          |
| POST   | `/fornecedores`         | Cria fornecedor (`nomeempresa` obrigatório) |
| PUT    | `/fornecedores/<id>`    | Atualiza campos fornecidos       |
| DELETE | `/fornecedores/<id>`    | Remove fornecedor                |

> A autenticação **não** é verificada pelo Python — essa responsabilidade fica no `server.js`, que valida a sessão antes de fazer o proxy. Por isso a porta 3001 é publicada só em `127.0.0.1`.

**Variáveis de ambiente:** `DB_HOST` / `DB_PORT` (mesmas do `db.js`) e `FLASK_HOST` (padrão `127.0.0.1`; no container, `0.0.0.0`). O proxy do Node encontra a API por `FORNECEDORES_HOST` / `FORNECEDORES_PORT` (padrão `localhost:3001`; no compose, `fornecedores:3001`).

---

### `src/soma.js`
Módulo utilitário com a função `soma(a, b)`. Criado na fase inicial do laboratório para demonstrar a estrutura de módulos e testes em Node.js.

---

### `src/soma.test.js`
Testes unitários da função `soma` usando `assert` nativo do Node.js.

```bash
node src/soma.test.js
```

---

### `src/usuarios.test.js`
Testes de integração do CRUD de usuários. Requer banco PostgreSQL ativo.

```bash
node src/usuarios.test.js
```

---

### `src/index.js`
Arquivo de exploração criado no início do laboratório. Contém apenas um `console.log` de boas-vindas. **Não é usado pela aplicação** — o ponto de entrada real é `src/server.js`.

---

### `src/public/index.html`
Landing page comercial do sistema. Exibida na raiz `/`. Não redireciona automaticamente — apresenta a descrição do produto com hero, cards de funcionalidades e botão de acesso.

**Comportamento:** verifica `GET /me` para exibir o nome do usuário logado e o botão "Sair" se houver sessão ativa; caso contrário, exibe o botão "Entrar".

---

### `src/public/login.html`
Formulário de autenticação. Layout centralizado com gradiente azul. Após login bem-sucedido, redireciona para `/clientes.html`.

---

### `src/public/clientes.html`
Página de CRUD de Clientes. Exige sessão autenticada (qualquer role). Redireciona para `/login.html` se não houver sessão. Contém formulário de cadastro/edição e tabela de listagem.

---

### `src/public/fornecedores.html`
Página de CRUD de Fornecedores. Exige sessão autenticada (qualquer role). Campos: Razão Social, Nome Fantasia, CNPJ, Telefone, E-mail, Endereço, Bairro, Cidade, Estado.

---

### `src/public/usuarios.html`
Página de CRUD de Usuários. Exige sessão com role **Admin** — outros perfis são redirecionados. Campos: Nome, E-mail, Senha, Perfil (Admin/Atendente/Visitante).

---

### `src/public/swagger.html`
Página que carrega o Swagger UI via CDN. Consome `swagger.json` para renderizar a documentação interativa de todos os endpoints da API.

---

### `src/public/swagger.json`
Especificação OpenAPI 3.0 da API completa. Documenta todas as rotas de Auth, Usuários, Clientes e Fornecedores com métodos, parâmetros, schemas de request/response, exemplos e códigos de retorno.

---

### `src/public/css/styles.css`
Design system completo do projeto. Define variáveis CSS globais e todos os componentes visuais.

**Componentes documentados:**

| Classe | Descrição |
|--------|-----------|
| `.header`, `.nav` | Cabeçalho fixo e menu de navegação |
| `.hero`, `.hero-title`, `.hero-subtitle` | Seção hero da landing page |
| `.feature-grid`, `.feature-card` | Grid de cards de funcionalidades |
| `.cta-card` | Card de call-to-action |
| `.main`, `.container`, `.landing-container` | Estrutura de layout |
| `.card`, `.card-title` | Card de conteúdo |
| `.form-grid`, `.form-group`, `.col-2` | Grid de formulário em 2 colunas |
| `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-outline`, `.btn-sm`, `.btn-lg` | Variantes de botão |
| `.badge`, `.badge-admin`, `.badge-atendente`, `.badge-visitante` | Badges de perfil |
| `.mensagem`, `.ok`, `.err` | Feedback de formulário |
| `.table-wrapper`, `table`, `.td-id`, `.acoes`, `.vazio` | Tabelas de listagem |
| `.login-body`, `.login-card` | Layout da tela de login |

---

### `src/public/js/auth.js`
Helpers de autenticação compartilhados por todas as páginas protegidas.

| Função | Descrição |
|--------|-----------|
| `verificarAuth(roleRequerido?)` | Chama `GET /me`; redireciona para `/login.html` se não autenticado ou para `/clientes.html` se role insuficiente |
| `configurarHeader(usuario)` | Preenche nome e badge do header; oculta elementos `[data-admin]` para não-Admin |
| `logout()` | Chama `POST /logout` e redireciona para `/login.html` |

---

### `src/public/js/login.js`
Captura o submit do formulário de login, chama `POST /login` e redireciona para `/clientes.html` em caso de sucesso.

---

### `src/public/js/clientes.js`
Lógica de interface do CRUD de Clientes. Chama `verificarAuth()` ao carregar. Funções: `carregar()`, `salvar(event)`, `editar(id)`, `deletar(id)`, `cancelarEdicao()`, `mostrarMensagem()`, `escHtml()`.

---

### `src/public/js/fornecedores.js`
Lógica de interface do CRUD de Fornecedores. Mesmo padrão de `clientes.js`. Gerencia os campos específicos de fornecedor: `nomeempresa`, `nomefantasia`, `cnpj`, `telefone`, `email`, `endereco`, `bairro`, `cidade`, `estado`.

---

### `src/public/js/usuarios.js`
Lógica de interface do CRUD de Usuários. Chama `verificarAuth('Admin')` ao carregar para garantir acesso restrito. Inclui seletor de role no formulário.

---

## Banco de Dados

### Tabela `usuarios`

```sql
CREATE TABLE usuarios (
  id    SERIAL PRIMARY KEY,
  nome  TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha TEXT NOT NULL DEFAULT '',   -- formato: salt:hash (crypto.scrypt)
  role  TEXT NOT NULL DEFAULT 'Atendente'
);
```

### Tabela `clientes`

```sql
CREATE TABLE clientes (
  id       SERIAL PRIMARY KEY,
  nome     TEXT NOT NULL,
  endereco TEXT,
  bairro   TEXT,
  cidade   TEXT,
  estado   TEXT,
  email    TEXT,
  telefone TEXT
);
```

### Tabela `fornecedores`

```sql
CREATE TABLE fornecedores (
  id           SERIAL PRIMARY KEY,
  nomefantasia TEXT,
  nomeempresa  TEXT NOT NULL,
  endereco     TEXT,
  bairro       TEXT,
  cidade       TEXT,
  estado       TEXT,
  email        TEXT,
  telefone     TEXT,
  cnpj         TEXT
);
```

> As três tabelas são criadas automaticamente na inicialização. `usuarios` e `clientes` são criadas pelo Node.js; `fornecedores` é criada pelo Python.

---

## Como Executar

### Opção 1 — Docker (recomendado)

Pré-requisito: Docker + Docker Compose.

```bash
docker compose up --build -d     # postgres (5151), node (3000), fornecedores (3001)
docker compose ps                # os 3 serviços "Up"
docker compose logs -f node      # logs do app
docker compose down              # parar (dados ficam no volume)
```

Portas configuráveis (`APP_PORT`, `API_PY_PORT`, `PG_PORT`) para rodar várias cópias lado a lado — ver `docs/SIMULANDO_2_DEVS.md`.

### Opção 2 — Sem Docker

Pré-requisitos: Node.js 24, Python 3.13 e PostgreSQL rodando em `localhost:5151`.

```bash
npm ci
pip install -r requirements-dev.txt     # inclui requirements.txt

# Terminal 1 — Servidor Node.js (porta 3000)
node src/server.js

# Terminal 2 — API Python Fornecedores (porta 3001)
python src/fornecedores_api.py
```

### URLs disponíveis

| URL | Descrição |
|-----|-----------|
| `http://localhost:3000` | Landing page comercial |
| `http://localhost:3000/login.html` | Login |
| `http://localhost:3000/clientes.html` | CRUD Clientes |
| `http://localhost:3000/fornecedores.html` | CRUD Fornecedores |
| `http://localhost:3000/usuarios.html` | CRUD Usuários (Admin) |
| `http://localhost:3000/produtos.html`, `estoque.html`, `carrinho.html`, `avaliacoes.html`, `eventos.html`, `relatorio.html` | Demais telas |
| `http://localhost:3000/api-docs` | Swagger UI |

### Credenciais

| Situação | Email | Senha |
|----------|-------|-------|
| Banco novo (criado automaticamente quando não há usuários) | `admin@labsystem.com` | `admin123` |
| Credencial de desenvolvimento do `CLAUDE.md` (criada no banco do compose principal) | `Alexaugusto2@gmail.com` | `admin123` |

---

## Testes

```bash
npm run lint                  # ESLint 10 — esperado: 0 problemas
npm run test:unit             # soma + mongo em memória (sem banco)
npm run test:integration      # usuários + redis (requer PostgreSQL ativo)
node src/teste_avaliacoes.js  # avaliações (adaptador Mongo em memória)
flake8 src/ tests/ --config=.flake8
pytest tests/ -v              # validação de CNPJ da API Python
bandit -r src/ -q             # SAST Python
```

Os mesmos comandos rodam no GitHub Actions (`.github/workflows/ci.yml`) em todo push e PR.

---

## Infraestrutura, CI/CD e qualidade

| Arquivo | O que faz |
|---------|-----------|
| `Dockerfile` | Imagem Node 24 (multi-stage, usuário não-root, **sem npm no runtime**) |
| `Dockerfile.python` | Imagem Python 3.13 (usuário não-root, **sem pip/setuptools/wheel no runtime**) |
| `docker-compose.yml` | Postgres + Node + Python; variáveis de host/porta; Postgres e API Python só em `127.0.0.1` |
| `.dockerignore` | Mantém fora da imagem docs, testes, `.env`, `node_modules` etc. |
| `.github/workflows/ci.yml` | Jobs separados: Lint (ESLint), Lint (Flake8), Testes unitários (Node/Python), Testes de integração (Postgres via `services:`), Scan de segurança (npm audit, pip-audit, bandit). `permissions: contents: read` |
| `.github/workflows/docker-build.yml` | Build + scan Trivy (automático em push/PR na `main`); publish no GHCR e deploy em produção só por disparo manual, deploy com aprovação no Environment `production` |
| `.github/dependabot.yml` | npm, pip, actions e docker, semanal; ignora trocas major de Node e minor/major de Python (decisão planejada) |
| `eslint.config.js` | Regras de lint JS (flat config) |
| `.flake8` | Regras de lint Python |
| `CODEOWNERS` | `@ScaTecnologia` revisa todas as áreas |
| `.github/ISSUE_TEMPLATE/`, `pull_request_template.md` | Modelos de card (tarefa/bug) e de PR |
| `docs/atualizar_docx.sh` | Regenera os `.docx` de `docs/` a partir dos `.md` (pandoc via Docker) |
| `.claude/hooks/` | `security-guardrail.js` (bloqueia `.env` e SQL interpolado) e `pipeline-guardrail.js` (impede publish/deploy automático) |

No GitHub (`ScaTecnologia/laboratorio-claude-code`, público): ruleset **"Proteger main"** (PR + 8 checks obrigatórios + aprovação de code owner), CodeQL, Dependabot, secret scanning, Environment `production` e o board Kanban em https://github.com/users/ScaTecnologia/projects/2.

---

## Dependências

### Node.js (`package.json`)

| Pacote | Tipo | Uso |
|--------|------|-----|
| `pg` | runtime | Driver PostgreSQL |
| `eslint`, `@eslint/js`, `globals` | dev | Lint (ESLint 10, flat config) |

### Python (`requirements.txt` / `requirements-dev.txt`)

| Pacote | Arquivo | Uso |
|--------|---------|-----|
| `flask` (≥3.1.3) | requirements | Framework HTTP da API de Fornecedores |
| `psycopg2-binary` (≥2.9.13) | requirements | Driver PostgreSQL para Python |
| `flake8`, `pytest`, `bandit`, `pip-audit` | requirements-dev | Lint, testes, SAST e auditoria de dependências |
