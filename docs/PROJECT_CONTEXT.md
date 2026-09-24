# PROJECT_CONTEXT.md

Contexto completo do projeto construído durante as sessões de laboratório com Claude Code.

---

## Visão Geral

**Nome:** LabSystem
**Objetivo:** Aplicação Node.js full-stack com autenticação, CRUD de Usuários, CRUD de Clientes e CRUD de Fornecedores, interface web responsiva e documentação interativa via Swagger.
**Runtime principal:** Node.js 24 LTS (CommonJS)
**Serviço auxiliar:** Python 3.13 + Flask (CRUD de Fornecedores)
**Banco de dados:** PostgreSQL 16 — `localhost:5151` — banco `laboratorio`
**Porta Node.js:** `3000`
**Porta Python:** `3001`
**Execução:** `docker compose up --build -d` (ou os dois processos manualmente)
**Repositório:** https://github.com/ScaTecnologia/laboratorio-claude-code (público) — board: https://github.com/users/ScaTecnologia/projects/2

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

## Sessão 3 — DevOps, CI/CD, Docker e trabalho em equipe (2026-09-24)

Feita numa máquina Linux nova, com Docker permitido (as máquinas Unisys anteriores não permitiam). Estado detalhado e pendências: `docs/STATUS_LABORATORIO.md`.

### 17. Docker ativado
- Código passou a ler host/porta de variáveis de ambiente (`DB_HOST`, `DB_PORT`, `FORNECEDORES_HOST`, `FORNECEDORES_PORT`, `FLASK_HOST`), com padrão `localhost` — dentro do container, `localhost` é o próprio container.
- `docker-compose.yml` sobe Postgres + Node + Python; Postgres e API Python publicados só em `127.0.0.1`.
- Imagens sem CVEs CRITICAL/HIGH corrigíveis: npm removido do runtime Node; pip/setuptools/wheel removidos do runtime Python.

### 18. Esteira CI/CD no GitHub
- Primeiro commit organizado (materiais de curso e logs de hooks no `.gitignore`), branch `main`, repositório `ScaTecnologia/laboratorio-claude-code` (público).
- `ci.yml` (lint, testes, integração com Postgres, scan de segurança) e `docker-build.yml` (build + scan Trivy automáticos; publish/deploy só manuais, deploy com aprovação no Environment `production`).
- `trivy-action` fixada pelo SHA do commit (a tag antiga deixou de existir).
- Hook `pipeline-guardrail.js` reescrito: impede o Claude Code de deixar publish/deploy automáticos.

### 19. Governança e segurança no GitHub
- Ruleset **"Proteger main"**: PR obrigatório, 8 checks obrigatórios, aprovação de code owner (admin pode dispensar só a aprovação enquanto há um único dev).
- `CODEOWNERS` corrigido (apontava para uma conta de terceiro) → `@ScaTecnologia`.
- CodeQL, Dependabot (alertas, correções e `dependabot.yml`), secret scanning com push protection.
- `permissions: contents: read` nos workflows (11 alertas do CodeQL resolvidos).

### 20. Board Kanban e exercício de 2 devs
- Board "LabSystem — Esteira" (Backlog / To Do / Em Progresso / Em Revisão / Concluído) com automações nativas ligadas.
- Exercício de conflito executado no GitHub real: issues #16/#17, PRs #18/#19, conflito no `git rebase` resolvido combinando as duas mudanças — `listar()` de clientes agora tem **limite padrão de 100 e ordem por nome**.

### 21. Atualização de dependências e runtimes
- Triagem dos PRs do Dependabot: 14 mesclados, 3 fechados com justificativa (Node 25 sem LTS, ESLint 10 sem migração, Python 3.14 só no Dockerfile).
- **Python 3.10 → 3.13** (o 3.10 perde suporte em 2026-10-31) e **Node 22 → 24 LTS**, no CI e nas imagens.
- **ESLint 8 → 10**: `.eslintrc.json` → `eslint.config.js` (flat config, mesmas regras); 9 avisos antigos limpos — lint com 0 problemas.
- `ioredis` removido (não era usado).

### 22. Simulação de vários devs com containers
- Portas do compose configuráveis (`APP_PORT`, `API_PY_PORT`, `PG_PORT`).
- Pastas `~/devs/dev1` (localhost:3010) e `~/devs/dev2` (localhost:3020): clone, autor Git e `portas.env` próprios — cada dev com seus containers e seu banco. Guia: `docs/SIMULANDO_2_DEVS.md`.
- Cards de prática: #27 (Dev 1, quantidade de clientes) e #29 (Dev 2, busca de fornecedores).

### 23. Documentação
- `ROTEIRO_CICD_CLAUDE_CODE.md` (Passo 7 reescrito), `SETUP_NOVA_MAQUINA.md`, `DEVOPS_GUIA.md`, `DOCS.md`, `ARCHITECTURE.md` e este arquivo atualizados.
- Corrigido: sessões **não** ficam em memória — ficam na tabela `sessoes` do PostgreSQL, com validade de 7 dias.
- `.docx` de `docs/` gerados a partir dos `.md` por `docs/atualizar_docx.sh` (pandoc via Docker).

---

## Estrutura de arquivos

```
laboratorio-claude-code/
├── src/
│   ├── server.js               # HTTP server Node.js, roteamento, auth, proxy
│   ├── usuarios.js             # CRUD usuários + hash de senha + migração
│   ├── clientes.js             # CRUD clientes
│   ├── sessoes.js              # Sessões na tabela sessoes (PostgreSQL, 7 dias)
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
| Email | `Alexaugusto2@gmail.com` |
| Senha | `admin123` |
| Role  | `Admin` |

> Em um **banco novo** (ex.: compose recém-criado, Dev 1/Dev 2), o sistema cria sozinho `admin@labsystem.com` / `admin123`. A senha deve ser alterada após o primeiro acesso.

---

## Como executar

```bash
# Com Docker (recomendado) — sobe Postgres + Node + Python
docker compose up --build -d
docker compose down

# Sem Docker — instalar dependências
npm ci
pip install -r requirements-dev.txt

# Terminal 1 — Servidor Node.js (porta 3000)
node src/server.js

# Terminal 2 — API Python Fornecedores (porta 3001)
python src/fornecedores_api.py

# Lint e testes (os mesmos do CI)
npm run lint
npm run test:unit
npm run test:integration    # requer banco ativo
pytest tests/ -v
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
| Sessões na tabela `sessoes` (PostgreSQL) | Persistem entre reinícios e são compartilhadas por várias instâncias; validade de 7 dias |
| Sem Express no Node.js | Projeto usa apenas `http` nativo para minimizar dependências |
| Cookie `HttpOnly` | Impede acesso ao token por JavaScript, mitigando XSS |
| Proteção de rota server-side | A API retorna 401/403 independentemente do frontend |
| CSS/JS separados do HTML | Seguindo a skill `frontend-layout-system` para reutilização entre páginas |
| Swagger via CDN | Sem instalação de pacote; arquivo `swagger.json` mantido manualmente |
| Python Flask para Fornecedores | Exigência de laboratório — demonstra integração de dois backends distintos |
| Auth centralizada no Node.js | O Python não valida sessão — o Node.js age como gateway e só repassa requisições autenticadas |
| Proxy via `req.pipe(proxyReq)` | Encaminha o body sem re-parsear — mantém o payload original intacto |
| Landing page sem redirect | `index.html` tornou-se vitrine comercial — o redirect automático foi removido |
| Host/porta por variável de ambiente | Mesmo código roda com e sem Docker; padrão `localhost` |
| Build + scan automáticos, publish/deploy manuais | Toda mudança é validada; nada chega a produção sem decisão humana |
| Corrigir a imagem em vez de afrouxar o scan | Ferramentas não usadas no runtime saem da imagem; `ignore-unfixed` só para CVEs sem correção |
| Actions de terceiros fixadas por SHA | Tags podem ser reapontadas ou apagadas; o SHA não |
| Runtimes só em versões LTS/suportadas | Node 24 LTS, Python 3.13; trocas de versão são decisão planejada (Dependabot ignora) |

---

## Pendências e próximos passos

| Item | Tipo | Prioridade |
|------|------|------------|
| `usuarios.test.js` desatualizado para testes com senha/role | Dívida técnica | Baixa |
| Paginação no frontend de clientes (a API já limita a 100) | Funcionalidade | Baixa |
| Servir o Flask com gunicorn na imagem Python | DevOps | Média (produção) |
| Node 24 → 26 LTS (depois de 2026-10-28) | Manutenção | Baixa |
| HTTPS para ambiente de produção | Segurança | Alta (produção) |

---

## Skills criadas

| Skill | Descrição |
|-------|-----------|
| `frontend-layout-system` | Padrão visual para páginas HTML/CSS/JS — cores, layout, componentes, acessibilidade, responsividade |
| `context-recovery` | Recupera contexto do projeto ao iniciar nova sessão — lê documentos na ordem certa, verifica git status e arquivos reais |
| `cicd-pipeline` | Padrão da esteira: jobs separados, publish/deploy só manuais, validar imagem localmente com compose + Trivy |
| `criar-funcao-com-teste` | Nova função JavaScript acompanhada de teste |

---

## Documentação gerada

| Arquivo | Conteúdo |
|---------|----------|
| `CLAUDE.md` | Regras, comandos, URLs, credenciais e skills para o Claude Code |
| `DOCS.md` | Descrição técnica completa de todos os 23 arquivos do projeto |
| `docs/PROJECT_CONTEXT.md` | Este arquivo — histórico e contexto de todas as sessões |
| `docs/ARCHITECTURE.md` | Diagramas, camadas, fluxos de auth, segurança, proxy, containers, esteira CI/CD |
| `docs/STATUS_LABORATORIO.md` | Onde paramos, o que foi feito, próximos passos (ler primeiro) |
| `docs/ROTEIRO_CICD_CLAUDE_CODE.md`, `DEVOPS_GUIA.md` | Como a esteira foi construída e a teoria de DevOps |
| `docs/COLABORACAO_EQUIPE.md`, `EXERCICIO_MULTIPLOS_DEVS.md`, `BACKLOG_KANBAN.md`, `SIMULANDO_2_DEVS.md` | Trabalho em equipe: branches, conflitos, board, vários devs com containers |
| `docs/SETUP_NOVA_MAQUINA.md` | Levar o laboratório para outra máquina |

---

## Dependências

### Node.js
| Pacote | Tipo | Uso |
|--------|------|-----|
| `pg` (`^8.23.0`) | runtime | Driver PostgreSQL (node-postgres) |
| `eslint` 10, `@eslint/js`, `globals` | dev | Lint (flat config) |

### Python
| Pacote | Arquivo | Uso |
|--------|---------|-----|
| `flask` (`>=3.1.3`) | requirements.txt | Framework HTTP da API de Fornecedores |
| `psycopg2-binary` (`>=2.9.13`) | requirements.txt | Driver PostgreSQL para Python |
| `flake8`, `pytest`, `bandit`, `pip-audit` | requirements-dev.txt | Lint, testes, SAST, auditoria de dependências |
