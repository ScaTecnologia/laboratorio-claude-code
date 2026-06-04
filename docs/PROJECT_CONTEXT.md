# PROJECT_CONTEXT.md

Contexto completo do projeto construído durante a sessão de laboratório com Claude Code.

---

## Visão Geral

**Nome:** LabSystem  
**Objetivo:** Aplicação Node.js full-stack com autenticação, CRUD de Usuários e CRUD de Clientes, interface web responsiva e documentação interativa via Swagger.  
**Runtime:** Node.js (CommonJS)  
**Banco de dados:** PostgreSQL — `localhost:5151` — banco `laboratorio`  
**Porta da aplicação:** `3000`

---

## O que foi construído nesta sessão

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

## Estrutura de arquivos

```
laboratorio-claude-code/
├── src/
│   ├── server.js          # HTTP server, roteamento, auth middleware
│   ├── usuarios.js        # CRUD usuários + hash de senha + migração
│   ├── clientes.js        # CRUD clientes
│   ├── db.js              # Conexão PostgreSQL (dois pools)
│   ├── sessoes.js         # Sessões em memória (Map)
│   ├── soma.js            # Utilitário de exemplo
│   ├── soma.test.js       # Testes da soma
│   ├── usuarios.test.js   # Testes do CRUD de usuários (requer DB)
│   └── public/
│       ├── index.html         # Redirect inteligente
│       ├── login.html         # Tela de login
│       ├── clientes.html      # CRUD de clientes
│       ├── usuarios.html      # CRUD de usuários (Admin)
│       ├── swagger.html       # Swagger UI (CDN)
│       ├── swagger.json       # Especificação OpenAPI 3.0
│       ├── css/
│       │   └── styles.css     # Design system completo
│       └── js/
│           ├── auth.js        # verificarAuth, configurarHeader, logout
│           ├── login.js       # Lógica do formulário de login
│           ├── usuarios.js    # CRUD de usuários no frontend
│           └── clientes.js    # CRUD de clientes no frontend
├── docs/
│   └── PROJECT_CONTEXT.md # Este arquivo
├── DOCS.md                # Documentação técnica de DevOps
├── CLAUDE.md              # Instruções do projeto para o Claude
└── package.json           # Node.js — dependência: pg ^8.21.0
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

---

## Rotas da API

### Auth
| Método | Rota      | Acesso | Descrição               |
|--------|-----------|--------|-------------------------|
| POST   | `/login`  | Livre  | Autentica e cria sessão |
| POST   | `/logout` | Livre  | Encerra sessão          |
| GET    | `/me`     | Livre  | Retorna usuário logado  |

### Usuários — Admin only
| Método | Rota             | Descrição              |
|--------|------------------|------------------------|
| GET    | `/usuarios`      | Lista todos            |
| GET    | `/usuarios/:id`  | Busca por ID           |
| POST   | `/usuarios`      | Cria (nome+email+senha+role) |
| PUT    | `/usuarios/:id`  | Atualiza (senha opcional) |
| DELETE | `/usuarios/:id`  | Remove (id=1 protegido) |

### Clientes — Autenticado
| Método | Rota            | Descrição     |
|--------|-----------------|---------------|
| GET    | `/clientes`     | Lista todos   |
| GET    | `/clientes/:id` | Busca por ID  |
| POST   | `/clientes`     | Cria          |
| PUT    | `/clientes/:id` | Atualiza      |
| DELETE | `/clientes/:id` | Remove        |

### Páginas e estáticos
| Rota              | Arquivo servido              |
|-------------------|------------------------------|
| `/`               | `index.html` (redirect)      |
| `/login.html`     | Tela de login                |
| `/clientes.html`  | CRUD de clientes             |
| `/usuarios.html`  | CRUD de usuários             |
| `/api-docs`       | Swagger UI                   |
| `/css/*`, `/js/*` | Estáticos de `src/public/`   |

---

## Credenciais padrão

| Campo | Valor |
|-------|-------|
| Email | `Alexaugusto2@gmail.com` (usuário id=1 existente) |
| Senha | `admin123` (definida automaticamente na migração) |
| Role  | `Admin` |

> A senha deve ser alterada após o primeiro acesso via tela de Usuários.

---

## Como executar

```bash
# Instalar dependências
npm install

# Iniciar o servidor
node src/server.js

# Rodar testes
node src/soma.test.js
node src/usuarios.test.js   # requer banco ativo
```

**URLs:**

| URL | Descrição |
|-----|-----------|
| `http://localhost:3000` | Aplicação (redireciona automaticamente) |
| `http://localhost:3000/api-docs` | Swagger UI |

---

## Decisões técnicas

| Decisão | Justificativa |
|---------|---------------|
| `crypto.scrypt` para senhas | Módulo nativo do Node.js — sem dependência extra; algoritmo recomendado para hashing de senhas |
| Sessões em memória (`Map`) | Simplicidade; adequado para laboratório — em produção usar Redis ou BD |
| Sem Express | Projeto usa apenas `http` nativo para minimizar dependências |
| Cookie `HttpOnly` | Impede acesso ao token por JavaScript, mitigando XSS |
| Proteção de rota server-side | A API retorna 401/403 independentemente do frontend — segurança real está no backend |
| CSS/JS separados do HTML | Seguindo a skill `frontend-layout-system` para facilitar reutilização entre páginas |
| Swagger via CDN | Sem instalação de pacote; arquivo `swagger.json` mantido manualmente |

---

## Skills criadas nesta sessão

| Skill | Descrição |
|-------|-----------|
| `frontend-layout-system` | Padrão visual para páginas HTML/CSS/JS — cores, layout, componentes, acessibilidade, responsividade |
| `context-recovery` | Recupera contexto do projeto ao iniciar nova sessão — lê documentos na ordem certa, verifica git status e estado real dos arquivos |

---

## Documentação gerada

| Arquivo | Conteúdo |
|---------|----------|
| `CLAUDE.md` | Regras, comandos, URLs, credenciais e skills para o Claude |
| `DOCS.md` | Descrição técnica de cada arquivo do projeto |
| `docs/PROJECT_CONTEXT.md` | Este arquivo — contexto completo da sessão |
| `docs/ARCHITECTURE.md` | Diagramas, camadas, fluxos de auth, segurança e evolução futura |

---

## Dependências

| Pacote | Versão     | Uso                              |
|--------|------------|----------------------------------|
| `pg`   | `^8.21.0`  | Driver PostgreSQL (node-postgres) |
