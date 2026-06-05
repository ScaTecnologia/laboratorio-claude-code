# Documentação Técnica — LabSystem

## Visão Geral

Aplicação web full-stack para gestão comercial. Expõe uma API REST para gerenciamento de **Usuários**, **Clientes** e **Fornecedores**, com autenticação por sessão, controle de acesso por perfil e interface web completa para uso via navegador.

O backend de Fornecedores roda em **Python (Flask)** na porta 3001. O servidor Node.js atua como gateway: valida a sessão e faz proxy das requisições para o serviço Python.

---

## Stack Tecnológica

| Camada           | Tecnologia                          |
|------------------|-------------------------------------|
| Runtime principal | Node.js (CommonJS)                 |
| Servidor HTTP    | `http` (módulo nativo do Node.js)   |
| API Fornecedores | Python 3 + Flask                    |
| Banco de dados   | PostgreSQL (porta 5151)             |
| Driver DB Node   | `pg` (node-postgres)                |
| Driver DB Python | `psycopg2-binary`                   |
| Frontend         | HTML + CSS + JavaScript puro        |
| API Docs         | Swagger UI (via CDN)                |

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
                ├── src/sessoes.js   ← Sessões em memória (Map)
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
│   ├── server.js               ← Ponto de entrada Node.js
│   ├── usuarios.js             ← CRUD usuários + autenticação
│   ├── clientes.js             ← CRUD clientes
│   ├── sessoes.js              ← Sessões em memória
│   ├── db.js                   ← Conexão PostgreSQL
│   ├── fornecedores_api.py     ← API Python Flask (porta 3001)
│   ├── soma.js                 ← Utilitário de exemplo
│   ├── soma.test.js            ← Testes da função soma
│   ├── usuarios.test.js        ← Testes do CRUD de usuários
│   ├── index.js                ← Arquivo de exploração inicial (não usado)
│   └── public/
│       ├── index.html          ← Landing page comercial
│       ├── login.html          ← Tela de login
│       ├── clientes.html       ← CRUD de clientes
│       ├── fornecedores.html   ← CRUD de fornecedores
│       ├── usuarios.html       ← CRUD de usuários (Admin)
│       ├── swagger.html        ← Swagger UI (carregado via CDN)
│       ├── swagger.json        ← Especificação OpenAPI 3.0
│       ├── css/
│       │   └── styles.css      ← Design system completo
│       └── js/
│           ├── auth.js         ← Helpers compartilhados de autenticação
│           ├── login.js        ← Lógica do formulário de login
│           ├── clientes.js     ← CRUD de clientes no frontend
│           ├── fornecedores.js ← CRUD de fornecedores no frontend
│           └── usuarios.js     ← CRUD de usuários no frontend
├── docs/
│   ├── PROJECT_CONTEXT.md      ← Histórico completo do que foi construído
│   └── ARCHITECTURE.md        ← Diagramas, fluxos, decisões técnicas
├── DOCS.md                     ← Este arquivo
├── CLAUDE.md                   ← Instruções do projeto para o Claude Code
├── package.json                ← Dependências Node.js
└── requirements.txt            ← Dependências Python
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
| `getSessao(req)` | Lê `sessao_id` do cookie e busca no Map de sessões |
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
Gerencia sessões de usuário em memória usando um `Map` JavaScript. Não persiste entre reinicializações do servidor.

**Funções exportadas:**

| Função | Descrição |
|--------|-----------|
| `criar(dados)` | Gera token aleatório de 64 bytes (hex), armazena `{ userId, role, nome }` no Map e retorna o token |
| `buscar(id)` | Retorna os dados da sessão pelo token ou `null` |
| `encerrar(id)` | Remove a sessão do Map |

> Em produção, substituir por sessões em Redis ou tabela no PostgreSQL para persistência e escalabilidade horizontal.

---

### `src/db.js`
Configura a conexão com o PostgreSQL via `pg`.

- **`garantirBanco()`**: conecta no banco `postgres` (admin) e cria o banco `laboratorio` se não existir.
- **`pool`**: Pool de conexões exportado para uso em todos os módulos de negócio. Configuração padrão de 10 conexões simultâneas.

**Configuração:**

| Parâmetro | Valor         |
|-----------|---------------|
| Host      | `localhost`   |
| Porta     | `5151`        |
| Usuário   | `postgres`    |
| Senha     | `5151`        |
| Banco     | `laboratorio` |

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

> A autenticação **não** é verificada pelo Python — essa responsabilidade fica no `server.js`, que valida a sessão antes de fazer o proxy.

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

### Pré-requisitos
- Node.js instalado
- Python 3.x instalado
- PostgreSQL rodando em `localhost:5151`

### Instalação

```bash
# Dependências Node.js
npm install

# Dependências Python
pip install -r requirements.txt
```

### Iniciar (dois terminais)

```bash
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
| `http://localhost:3000/api-docs` | Swagger UI |

### Credenciais padrão

| Campo | Valor |
|-------|-------|
| Email | `Alexaugusto2@gmail.com` |
| Senha | `admin123` |
| Role  | `Admin` |

---

## Testes

```bash
node src/soma.test.js         # testes da função soma (sem banco)
node src/usuarios.test.js     # testes do CRUD de usuários (requer banco ativo)
```

---

## Dependências

### Node.js (`package.json`)

| Pacote | Versão    | Uso |
|--------|-----------|-----|
| `pg`   | `^8.21.0` | Driver PostgreSQL |

### Python (`requirements.txt`)

| Pacote            | Versão   | Uso |
|-------------------|----------|-----|
| `flask`           | `>=3.0.0` | Framework HTTP da API de Fornecedores |
| `psycopg2-binary` | `>=2.9.9` | Driver PostgreSQL para Python |
