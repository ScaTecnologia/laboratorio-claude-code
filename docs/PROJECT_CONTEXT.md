# PROJECT_CONTEXT.md

Contexto completo do projeto construído durante as sessões de laboratório com Claude Code.

---

## Visão Geral

**Nome:** LabSystem
**Objetivo:** Aplicação Node.js full-stack com autenticação, CRUD de Usuários, CRUD de Clientes e CRUD de Fornecedores, interface web responsiva e documentação interativa via Swagger.
**Runtime principal:** Node.js (CommonJS)
**Serviço auxiliar:** Python 3 + Flask (CRUD de Fornecedores)
**Banco de dados:** PostgreSQL — `localhost:5151` — banco `laboratorio`
**Porta Node.js:** `3000`
**Porta Python:** `3001`

---

## Sessão 1 — Construção base

### 1. CRUD de Usuários em memória
- Ponto de partida: funções `criar`, `listar`, `buscar`, `atualizar`, `deletar` em `src/usuarios.js` operando sobre um array em memória.

### 2. Interface web inicial
- Página `src/public/index.html` com formulário e tabela para consumir a API REST via `fetch`.

### 3. Migração para PostgreSQL
- Instalado o driver `pg` (node-postgres).
- Criado `src/db.js` com dois pools: um admin (banco `postgres`) para criação automática do banco, e um da aplicação (banco `laboratorio`).
- `src/usuarios.js` reescrito para queries SQL parametrizadas.
- Banco e tabela criados automaticamente na inicialização.

### 4. API REST documentada no Swagger
- Swagger UI servido em `/api-docs` via CDN, sem dependências extras.
- Especificação OpenAPI em `src/public/swagger.json`.
- Documentação cobre: Auth (`/login`, `/logout`, `/me`), Usuários e Clientes com todos os métodos, schemas, exemplos e códigos de resposta.

### 5. Documentação técnica (DOCS.md)
- Arquivo `DOCS.md` na raiz com arquitetura, descrição de cada arquivo, schema do banco, comandos e tabela de dependências.

### 6. Skill de frontend criada
- `.claude/skills/frontend-layout-system/SKILL.md` — guia de padrão visual para todas as páginas do projeto (cores, layout, componentes, acessibilidade, responsividade).

### 7. Refatoração visual completa
- CSS separado em `src/public/css/styles.css` com variáveis CSS, design system completo.
- JS separado em `src/public/js/usuarios.js`.
- Layout com header fixo, nav, main, footer, cards, badges, botões tipados, feedback visual.
- Servidor atualizado para servir arquivos estáticos de `src/public/` com proteção contra path traversal.

### 8. Autenticação e controle de acesso
- **Senhas criptografadas** com `crypto.scrypt` (módulo nativo do Node.js — sem biblioteca externa).
- **Sessões server-side** em `src/sessoes.js` usando `Map` em memória com token aleatório de 64 bytes.
- **Cookie `sessao_id`** com flag `HttpOnly` e `Max-Age` de 7 dias.
- **Roles:** `Admin`, `Atendente`, `Visitante`.
- Usuário `id=1` sempre promovido a `Admin` na inicialização.
- Migração automática: se usuário existe sem senha (dados antigos), aplica hash de `admin123`.

### 9. CRUD de Clientes
- Tabela `clientes` com campos: `id`, `nome`, `endereco`, `bairro`, `cidade`, `estado`, `email`, `telefone`.
- Módulo `src/clientes.js` com funções assíncronas idênticas ao padrão de usuários.
- Acesso restrito a usuários autenticados (qualquer role).

### 10. Navegação e páginas protegidas
- `index.html` — redirect automático: logado → `/clientes.html`, deslogado → `/login.html`.
- `login.html` — formulário de login com gradiente azul.
- `clientes.html` — CRUD de clientes com header, nav e menu.
- `usuarios.html` — CRUD de usuários (acesso restrito: Admin).
- `src/public/js/auth.js` — helpers compartilhados: `verificarAuth()`, `configurarHeader()`, `logout()`.
- Link "Usuários" no menu visível apenas para `Admin` (`data-admin`).

---

## Sessão 2 — Fornecedores, landing page e documentação

### 11. CRUD de Fornecedores com backend Python
- Criado `src/fornecedores_api.py` — API Flask rodando na porta 3001.
- Criado `requirements.txt` com dependências `flask>=3.0.0` e `psycopg2-binary>=2.9.9`.
- Tabela `fornecedores` criada automaticamente pelo Python na inicialização.
- Campos: `id`, `nomefantasia`, `nomeempresa`, `endereco`, `bairro`, `cidade`, `estado`, `email`, `telefone`, `cnpj`.
- Campo `nomeempresa` obrigatório; todos os demais são opcionais.

### 12. Proxy Node.js → Python
- `src/server.js` atualizado com a função `proxyParaPython(req, res)`.
- O Node.js valida a sessão antes de fazer proxy — o Python não implementa autenticação.
- Corpo da requisição é pipado diretamente (sem re-parsear o JSON), preservando o payload original.
- Erro 502 retornado caso o servidor Python esteja fora do ar, com mensagem orientando como iniciá-lo.
- Rota `/fornecedores.html` adicionada ao servidor Node.js.

### 13. Landing page comercial
- `src/public/index.html` completamente reescrito — não redireciona mais automaticamente.
- Exibe hero com gradiente, grid de 4 cards de funcionalidades e card de call-to-action.
- Verifica sessão via `GET /me`: se logado, mostra nome/badge e botão "Sair"; se não logado, mostra botão "Entrar".
- Adicionadas classes CSS ao `styles.css`: `.hero`, `.feature-grid`, `.feature-card`, `.cta-card`, `.btn-lg`, `.landing-container`, `.section-title`.

### 14. Navegação atualizada
- Link "Fornecedores" adicionado ao menu de todas as páginas: `index.html`, `clientes.html`, `usuarios.html` e `fornecedores.html`.
- Ordem do menu: Clientes → Fornecedores → Usuários (Admin) → API Docs.

### 15. Swagger atualizado
- Adicionadas rotas de Fornecedores: `GET/POST /fornecedores` e `GET/PUT/DELETE /fornecedores/{id}`.
- Adicionados schemas `Fornecedor` e `FornecedorInput` com os 10 campos.
- Tag "Fornecedores" criada como grupo separado no Swagger UI.
- Descrição geral da API atualizada para mencionar o proxy Node→Python.
- Resposta `502` documentada em todas as rotas de Fornecedores.

### 16. DOCS.md reescrito
- Reescrita completa — a versão anterior documentava apenas a fase inicial do projeto.
- Agora cobre os 23 arquivos ativos do projeto com funções, responsabilidades e tabelas de rotas.
- Inclui tabela completa do design system CSS, schemas das 3 tabelas e seção de dependências Python.

---

## Estrutura de arquivos

```
laboratorio-claude-code/
├── src/
│   ├── server.js               # HTTP server Node.js, roteamento, auth, proxy
│   ├── usuarios.js             # CRUD usuários + hash de senha + migração
│   ├── clientes.js             # CRUD clientes
│   ├── sessoes.js              # Sessões em memória (Map)
│   ├── db.js                   # Conexão PostgreSQL (dois pools)
│   ├── fornecedores_api.py     # API Python Flask — CRUD Fornecedores (porta 3001)
│   ├── soma.js                 # Utilitário de exemplo
│   ├── soma.test.js            # Testes da soma
│   ├── usuarios.test.js        # Testes do CRUD de usuários (requer DB)
│   ├── index.js                # Arquivo de exploração inicial (não usado)
│   └── public/
│       ├── index.html          # Landing page comercial
│       ├── login.html          # Tela de login
│       ├── clientes.html       # CRUD de clientes
│       ├── fornecedores.html   # CRUD de fornecedores
│       ├── usuarios.html       # CRUD de usuários (Admin)
│       ├── swagger.html        # Swagger UI (CDN)
│       ├── swagger.json        # Especificação OpenAPI 3.0
│       ├── css/
│       │   └── styles.css      # Design system completo
│       └── js/
│           ├── auth.js         # verificarAuth, configurarHeader, logout
│           ├── login.js        # Lógica do formulário de login
│           ├── usuarios.js     # CRUD de usuários no frontend
│           ├── clientes.js     # CRUD de clientes no frontend
│           └── fornecedores.js # CRUD de fornecedores no frontend
├── docs/
│   ├── PROJECT_CONTEXT.md      # Este arquivo
│   └── ARCHITECTURE.md        # Diagramas, camadas, fluxos, segurança
├── DOCS.md                     # Descrição técnica de cada arquivo
├── CLAUDE.md                   # Instruções do projeto para o Claude Code
├── package.json                # Node.js — dependência: pg ^8.21.0
└── requirements.txt            # Python — flask >=3.0.0, psycopg2-binary >=2.9.9
```

---

## Banco de dados

**Conexão:** `postgresql://postgres:5151@localhost:5151/laboratorio`

### Tabela `usuarios`

```sql
CREATE TABLE usuarios (
  id    SERIAL PRIMARY KEY,
  nome  TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha TEXT NOT NULL DEFAULT '',  -- hash scrypt: salt:key
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

> `usuarios` e `clientes` são criadas pelo Node.js na inicialização. `fornecedores` é criada pelo Python na inicialização.

---

## Rotas da API

### Auth
| Método | Rota      | Acesso | Descrição               |
|--------|-----------|--------|-------------------------|
| POST   | `/login`  | Livre  | Autentica e cria sessão |
| POST   | `/logout` | Livre  | Encerra sessão          |
| GET    | `/me`     | Livre  | Retorna usuário logado  |

### Usuários — Admin only
| Método | Rota             | Descrição                         |
|--------|------------------|-----------------------------------|
| GET    | `/usuarios`      | Lista todos                       |
| GET    | `/usuarios/:id`  | Busca por ID                      |
| POST   | `/usuarios`      | Cria (nome + email + senha + role) |
| PUT    | `/usuarios/:id`  | Atualiza (senha opcional)         |
| DELETE | `/usuarios/:id`  | Remove (id=1 protegido)           |

### Clientes — Autenticado
| Método | Rota            | Descrição     |
|--------|-----------------|---------------|
| GET    | `/clientes`     | Lista todos   |
| GET    | `/clientes/:id` | Busca por ID  |
| POST   | `/clientes`     | Cria          |
| PUT    | `/clientes/:id` | Atualiza      |
| DELETE | `/clientes/:id` | Remove        |

### Fornecedores — Autenticado (proxy → Python :3001)
| Método | Rota                 | Descrição                          |
|--------|----------------------|------------------------------------|
| GET    | `/fornecedores`      | Lista todos                        |
| GET    | `/fornecedores/:id`  | Busca por ID                       |
| POST   | `/fornecedores`      | Cria (`nomeempresa` obrigatório)    |
| PUT    | `/fornecedores/:id`  | Atualiza campos fornecidos         |
| DELETE | `/fornecedores/:id`  | Remove                             |

### Páginas e estáticos
| Rota                  | Arquivo servido                  |
|-----------------------|----------------------------------|
| `/`                   | `index.html` (landing page)      |
| `/login.html`         | Tela de login                    |
| `/clientes.html`      | CRUD de clientes                 |
| `/fornecedores.html`  | CRUD de fornecedores             |
| `/usuarios.html`      | CRUD de usuários                 |
| `/api-docs`           | Swagger UI                       |
| `/css/*`, `/js/*`     | Estáticos de `src/public/`       |

---

## Credenciais padrão

| Campo | Valor |
|-------|-------|
| Email | `Alexaugusto2@gmail.com` (usuário id=1) |
| Senha | `admin123` |
| Role  | `Admin` |

> A senha deve ser alterada após o primeiro acesso.

---

## Como executar

```bash
# Instalar dependências
npm install
pip install -r requirements.txt

# Terminal 1 — Servidor Node.js (porta 3000)
node src/server.js

# Terminal 2 — API Python Fornecedores (porta 3001)
python src/fornecedores_api.py

# Testes
node src/soma.test.js
node src/usuarios.test.js   # requer banco ativo
```

**URLs:**

| URL | Descrição |
|-----|-----------|
| `http://localhost:3000` | Landing page |
| `http://localhost:3000/clientes.html` | CRUD Clientes |
| `http://localhost:3000/fornecedores.html` | CRUD Fornecedores |
| `http://localhost:3000/api-docs` | Swagger UI |

---

## Decisões técnicas

| Decisão | Justificativa |
|---------|---------------|
| `crypto.scrypt` para senhas | Módulo nativo do Node.js — sem dependência extra; algoritmo recomendado para hashing de senhas |
| Sessões em memória (`Map`) | Simplicidade; adequado para laboratório — em produção usar Redis ou BD |
| Sem Express no Node.js | Projeto usa apenas `http` nativo para minimizar dependências |
| Cookie `HttpOnly` | Impede acesso ao token por JavaScript, mitigando XSS |
| Proteção de rota server-side | A API retorna 401/403 independentemente do frontend |
| CSS/JS separados do HTML | Seguindo a skill `frontend-layout-system` para reutilização entre páginas |
| Swagger via CDN | Sem instalação de pacote; arquivo `swagger.json` mantido manualmente |
| Python Flask para Fornecedores | Exigência de laboratório — demonstra integração de dois backends distintos |
| Auth centralizada no Node.js | O Python não valida sessão — o Node.js age como gateway e só repassa requisições autenticadas |
| Proxy via `req.pipe(proxyReq)` | Encaminha o body sem re-parsear — mantém o payload original intacto |
| Landing page sem redirect | `index.html` tornou-se vitrine comercial — o redirect automático foi removido |

---

## Pendências e próximos passos

| Item | Tipo | Prioridade |
|------|------|------------|
| Sessões persistentes (Redis ou tabela no BD) | Melhoria de infraestrutura | Média |
| `usuarios.test.js` desatualizado para testes com senha/role | Dívida técnica | Baixa |
| Paginação nas listagens (clientes, fornecedores) | Funcionalidade | Baixa |
| Máscara de CNPJ no campo de fornecedores | UX | Baixa |
| Validação de formato de CNPJ no backend Python | Segurança/validação | Média |
| Refatorar `server.js` em `routes/` e `middlewares/` | Estrutura de código | Baixa |
| Supervisord ou PM2 para gerenciar os dois processos | DevOps | Baixa |
| HTTPS para ambiente de produção | Segurança | Alta (produção) |

---

## Skills criadas

| Skill | Descrição |
|-------|-----------|
| `frontend-layout-system` | Padrão visual para páginas HTML/CSS/JS — cores, layout, componentes, acessibilidade, responsividade |
| `context-recovery` | Recupera contexto do projeto ao iniciar nova sessão — lê documentos na ordem certa, verifica git status e arquivos reais |

---

## Documentação gerada

| Arquivo | Conteúdo |
|---------|----------|
| `CLAUDE.md` | Regras, comandos, URLs, credenciais e skills para o Claude Code |
| `DOCS.md` | Descrição técnica completa de todos os 23 arquivos do projeto |
| `docs/PROJECT_CONTEXT.md` | Este arquivo — histórico e contexto de todas as sessões |
| `docs/ARCHITECTURE.md` | Diagramas, camadas, fluxos de auth, segurança, proxy e evolução futura |

---

## Dependências

### Node.js
| Pacote | Versão    | Uso                               |
|--------|-----------|-----------------------------------|
| `pg`   | `^8.21.0` | Driver PostgreSQL (node-postgres) |

### Python
| Pacote            | Versão    | Uso                                        |
|-------------------|-----------|--------------------------------------------|
| `flask`           | `>=3.0.0` | Framework HTTP da API de Fornecedores      |
| `psycopg2-binary` | `>=2.9.9` | Driver PostgreSQL para Python              |
