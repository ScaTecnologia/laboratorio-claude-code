# ARCHITECTURE.md


Documento de arquitetura do **LabSystem** — decisões estruturais, camadas, fluxos e componentes.
---

## Visão geral

O LabSystem é uma aplicação com **dois servidores backend**: um servidor Node.js (porta 3000) que centraliza autenticação, roteamento e os CRUDs de Usuários e Clientes, e um serviço Python Flask (porta 3001) responsável exclusivamente pelo CRUD de Fornecedores. O Node.js atua como **gateway**: valida a sessão e faz proxy das requisições de `/fornecedores/*` para o Python.

```
┌─────────────────────────────────────────────────────────────┐
│                        NAVEGADOR                            │
│                                                             │
│  index.html  login.html  clientes.html  fornecedores.html   │
│  usuarios.html            api-docs                          │
│      │            │            │               │            │
│  (landing)    login.js    clientes.js    fornecedores.js    │
│                              │                │             │
│                           usuarios.js      auth.js          │
│                              └───────────────┘             │
│                                     │                       │
│                           fetch() — HTTP/1.1               │
└─────────────────────────────────────────────────────────────┘
                              │
                   Cookie: sessao_id (HttpOnly)
                              │
┌─────────────────────────────────────────────────────────────┐
│               SERVIDOR NODE.JS — porta 3000                 │
│                      src/server.js                          │
│                                                             │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │ Roteador │  │ Auth Helpers │  │ Arquivos estáticos  │   │
│  │   HTTP   │  │ parseCookies │  │    src/public/      │   │
│  │          │  │ getSessao    │  │                     │   │
│  └────┬─────┘  └──────┬───────┘  └─────────────────────┘   │
│       │               │                                     │
│  ┌────▼───────────────▼────────────────────────────────┐    │
│  │               Handlers de Rota                      │    │
│  │  /login  /logout  /me  /usuarios  /clientes         │    │
│  │  /fornecedores/* ──► proxyParaPython()              │    │
│  └────────┬──────────────────────┬──────────┬──────────┘    │
│           │                      │          │               │
│  ┌────────▼───────┐  ┌───────────▼──────┐   │              │
│  │ src/sessoes.js │  │ src/usuarios.js  │   │              │
│  │ Map em memória │  │ src/clientes.js  │   │              │
│  └────────────────┘  └───────────┬──────┘   │              │
│                                  │          │               │
│                         ┌────────▼──────┐   │              │
│                         │  src/db.js    │   │              │
│                         │  Pool pg      │   │              │
│                         └────────┬──────┘   │              │
└──────────────────────────────────┼──────────┼──────────────┘
                                   │          │ proxy HTTP
                                   │    ┌─────▼──────────────────┐
                                   │    │  SERVIÇO PYTHON        │
                                   │    │  src/fornecedores_api  │
                                   │    │  Flask — porta 3001    │
                                   │    │                        │
                                   │    │  GET/POST /fornecedores│
                                   │    │  GET/PUT/DELETE /<id>  │
                                   │    └─────┬──────────────────┘
                                   │          │
┌──────────────────────────────────▼──────────▼──────────────┐
│              PostgreSQL — localhost:5151                    │
│                   banco: laboratorio                       │
│                                                            │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  │
│  │   usuarios    │  │   clientes    │  │ fornecedores  │  │
│  └───────────────┘  └───────────────┘  └───────────────┘  │
└────────────────────────────────────────────────────────────┘
```

---

## Camadas

### Camada 1 — Frontend (Browser)

Páginas HTML estáticas servidas pelo servidor Node.js a partir de `src/public/`. Toda interação com dados ocorre via `fetch()` chamando a API REST no mesmo host (porta 3000), independentemente de qual backend processa a requisição.

| Arquivo | Responsabilidade |
|---------|-----------------|
| `css/styles.css` | Design system: variáveis, layout, componentes, responsividade, landing page |
| `js/auth.js` | `verificarAuth()`, `configurarHeader()`, `logout()` — compartilhado por todas as páginas |
| `js/login.js` | Submissão do formulário de login |
| `js/usuarios.js` | CRUD de usuários no frontend |
| `js/clientes.js` | CRUD de clientes no frontend |
| `js/fornecedores.js` | CRUD de fornecedores no frontend |

**Proteção no frontend:**
- Toda página protegida chama `verificarAuth()` ao carregar.
- `verificarAuth()` faz `GET /me`; se retornar 401, redireciona para `/login.html`.
- Se o role não for suficiente, redireciona para `/clientes.html`.
- O link "Usuários" no menu é ocultado via `[data-admin]` para não-Admin.

> O frontend é a primeira barreira de UX. A barreira de segurança real está na camada do servidor.

---

### Camada 2 — Gateway Node.js (porta 3000)

`src/server.js` é o único ponto de entrada público da aplicação. Centraliza autenticação, roteamento e controle de acesso.

**Responsabilidades exclusivas desta camada:**
- Gerenciar sessões (criar, validar, encerrar)
- Verificar autenticação e role antes de qualquer operação
- Servir as páginas HTML e arquivos estáticos
- Delegar operações de usuários/clientes para os módulos Node.js
- Fazer proxy autenticado das requisições de fornecedores para o Python

#### Ordem de resolução de rotas

```
Requisição HTTP
      │
      ├─ GET /                    → serve index.html (landing page)
      ├─ GET /login.html          → serve login.html
      ├─ GET /fornecedores.html   → serve fornecedores.html
      ├─ GET /api-docs            → serve swagger.html
      │
      ├─ POST /login              → autentica, cria sessão, define cookie
      ├─ POST /logout             → encerra sessão, limpa cookie
      ├─ GET  /me                 → retorna usuário da sessão
      │
      ├─ /usuarios/*              → verifica sessão + role Admin → CRUD
      ├─ /clientes/*              → verifica sessão → CRUD
      ├─ /fornecedores/*          → verifica sessão → proxy para Python :3001
      │
      ├─ Arquivo em public/       → serve estático (CSS, JS, JSON...)
      │
      └─ 404
```

#### Helpers internos do servidor

| Função | O que faz |
|--------|-----------|
| `lerBody(req)` | Lê e parseia o JSON do body da requisição |
| `responder(res, status, dados)` | Serializa e envia resposta JSON |
| `parseCookies(req)` | Extrai cookies do header `Cookie` |
| `getSessao(req)` | Lê `sessao_id` do cookie e busca no Map de sessões |
| `setCookie(res, name, value, opts)` | Define header `Set-Cookie` com `HttpOnly` |
| `servirArquivo(res, filePath)` | Serve arquivo estático com Content-Type correto |
| `proxyParaPython(req, res)` | Faz pipe da requisição (com body) para `localhost:3001` e retorna a resposta |

---

### Camada 3 — Serviço Python Flask (porta 3001)

`src/fornecedores_api.py` é um microserviço independente responsável exclusivamente pelo CRUD de Fornecedores. Não implementa autenticação — confia que o Node.js só repassa requisições já validadas.

**Responsabilidades:**
- Criar a tabela `fornecedores` na inicialização
- Expor 5 endpoints REST
- Conectar-se diretamente ao PostgreSQL via `psycopg2`
- Retornar JSON em todas as respostas

> Este serviço **não deve ser acessado diretamente** em produção — todas as requisições devem passar pelo Node.js.

---

### Camada 4 — Módulos de Negócio Node.js

Cada recurso tem seu próprio módulo com funções assíncronas puras. Nenhum módulo conhece o protocolo HTTP.

#### `src/usuarios.js`

```
hashSenha(senha)         → Promise<string>   "salt:hash" via crypto.scrypt
verificarSenha(s, hash)  → Promise<boolean>
inicializar()            → cria tabela, migra senhas vazias, garante Admin id=1
criar(nome, email, senha, role)
listar()                 → sem o campo senha
buscar(id)               → sem o campo senha
buscarPorEmail(email)    → COM o campo senha (usado só no login)
atualizar(id, dados)     → senha re-hasheada se fornecida
deletar(id)
```

> `senha` nunca é retornada nas funções de leitura pública. Só `buscarPorEmail` a inclui, e essa função é chamada exclusivamente pelo handler de login.

#### `src/clientes.js`

```
inicializar()
criar(dados)
listar()
buscar(id)
atualizar(id, dados)
deletar(id)
```

#### `src/sessoes.js`

```
criar(dados)   → gera token de 64 bytes (hex), armazena em Map, retorna token
buscar(id)     → retorna dados da sessão ou null
encerrar(id)   → remove do Map
```

#### `src/db.js`

```
garantirBanco()  → conecta em "postgres", cria "laboratorio" se não existir
pool             → Pool de conexões para o banco "laboratorio"
```

---

## Padrão proxy Node.js → Python

O proxy foi implementado sem bibliotecas externas, usando apenas o módulo `http` nativo do Node.js:

```
Requisição do browser
        │
        ▼
server.js recebe /fornecedores/*
        │
        ▼
getSessao(req)  ──►  null?  ──►  401 Não autenticado
        │
        ▼
sessão válida
        │
        ▼
proxyParaPython(req, res)
        │
        ├─ http.request({ host: localhost, port: 3001, path: req.url, method })
        │
        ├─ req.pipe(proxyReq)    ← body enviado diretamente sem re-parsear
        │
        ├─ proxyRes.pipe(res)    ← resposta Python retornada ao browser
        │
        └─ on('error') → 502 com mensagem de como iniciar o Python
```

**Decisão técnica:** o corpo da requisição é pipado diretamente (`req.pipe(proxyReq)`) sem passar por `lerBody()`. Isso garante que o payload original chega intacto ao Python sem dupla serialização.

---

## Fluxo de autenticação

```
Usuário preenche login.html
          │
          ▼
POST /login  {email, senha}
          │
          ├─ buscarPorEmail(email)  →  null  →  401 Credenciais inválidas
          │
          ├─ verificarSenha(senha, usuario.senha)
          │       │
          │       ├─ false  →  401 Credenciais inválidas
          │       │
          │       └─ true
          │             │
          │             ▼
          │    sessoes.criar({userId, role, nome})
          │             │
          │             ▼
          │    Set-Cookie: sessao_id=<token64>; HttpOnly; Path=/; Max-Age=604800
          │             │
          │             ▼
          │    200  {id, nome, role}
          │
          ▼
    Redirect → /clientes.html
          │
          ▼
    GET /me  (cookie enviado automaticamente)
          │
          ├─ sessoes.buscar(sessao_id)  →  null  →  401
          │
          └─ sessão válida  →  200 {id, nome, role}
                    │
                    └─ configurarHeader(usuario)
                              │
                              └─ oculta [data-admin] se role ≠ Admin
```

---

## Fluxo de requisição autenticada (Clientes/Usuários)

```
fetch('/clientes', { credentials: 'include' })
         │
         ▼  Cookie: sessao_id=abc123 enviado pelo browser
         │
    server.js recebe requisição
         │
         ▼
    getSessao(req)
         │
         ├─ sessao = null  →  401 Não autenticado
         │
         └─ sessao válida
                  │
                  ▼
            clientesModule.listar()
                  │
                  ▼
            pool.query('SELECT * FROM clientes ...')
                  │
                  ▼
            200 [{...}, ...]
```

---

## Fluxo de requisição autenticada (Fornecedores — proxy)

```
fetch('/fornecedores', { credentials: 'include' })
         │
         ▼  Cookie: sessao_id=abc123 enviado pelo browser
         │
    server.js recebe requisição
         │
         ▼
    getSessao(req)
         │
         ├─ sessao = null  →  401 Não autenticado
         │
         └─ sessao válida
                  │
                  ▼
            proxyParaPython(req, res)
                  │
                  ▼
            http.request(localhost:3001/fornecedores)
                  │
                  │  [sem autenticação — Python confia no gateway]
                  ▼
            fornecedores_api.py processa
                  │
                  ▼
            pool.execute('SELECT * FROM fornecedores ...')
                  │
                  ▼
            200 [{...}, ...]  pipado de volta ao browser
```

---

## Segurança

| Vetor | Proteção implementada |
|-------|-----------------------|
| Senhas em texto claro | `crypto.scrypt` com salt aleatório de 16 bytes — hash de 64 bytes |
| Roubo de cookie via JS | `HttpOnly` impede acesso pelo JavaScript |
| Acesso não autorizado à API | Verificação de sessão em toda rota protegida no servidor |
| Escalada de privilégio | Role verificada no servidor, não apenas no frontend |
| Remoção do admin | `DELETE /usuarios/1` bloqueado explicitamente |
| Path traversal em estáticos | `path.resolve` + verificação de prefixo `publicDir` |
| Injeção de SQL (Node) | Queries parametrizadas (`$1`, `$2`) em todas as operações |
| Injeção de SQL (Python) | Queries parametrizadas (`%s`) via psycopg2 |
| XSS via tabela | `escHtml()` aplicado em todos os valores renderizados no DOM |
| Acesso direto ao Python | Python na porta 3001 deve ser acessado apenas localmente — não exposto publicamente |

---

## Banco de dados

### Diagrama de tabelas

```
┌─────────────────────────────┐  ┌─────────────────────────────┐  ┌──────────────────────────────┐
│          usuarios           │  │           clientes          │  │         fornecedores         │
├─────────────────────────────┤  ├─────────────────────────────┤  ├──────────────────────────────┤
│ id       SERIAL  PK         │  │ id       SERIAL  PK         │  │ id           SERIAL  PK      │
│ nome     TEXT    NOT NULL   │  │ nome     TEXT    NOT NULL   │  │ nomeempresa  TEXT    NOT NULL │
│ email    TEXT    NOT NULL   │  │ endereco TEXT               │  │ nomefantasia TEXT             │
│          UNIQUE             │  │ bairro   TEXT               │  │ cnpj         TEXT             │
│ senha    TEXT    NOT NULL   │  │ cidade   TEXT               │  │ endereco     TEXT             │
│ role     TEXT    NOT NULL   │  │ estado   TEXT               │  │ bairro       TEXT             │
│          DEFAULT 'Atendente'│  │ email    TEXT               │  │ cidade       TEXT             │
└─────────────────────────────┘  │ telefone TEXT               │  │ estado       TEXT             │
                                 └─────────────────────────────┘  │ email        TEXT             │
                                                                   │ telefone     TEXT             │
                                                                   └──────────────────────────────┘
```

As tabelas não têm relacionamento entre si. Expansões futuras (ex: fornecedor vinculado a um pedido) exigiriam chaves estrangeiras.

**Criação das tabelas:**
- `usuarios` e `clientes`: criadas pelo Node.js (`src/usuarios.js` e `src/clientes.js`) na inicialização via `inicializar()`.
- `fornecedores`: criada pelo Python (`src/fornecedores_api.py`) na função `init_db()` ao iniciar.

### Pool de conexões

- **Node.js:** `db.js` exporta um único `Pool` do `pg`. Padrão de 10 conexões simultâneas.
- **Python:** cada função abre e fecha uma conexão via `psycopg2.connect()`. Para produção, usar `psycopg2.pool.ThreadedConnectionPool`.

---

## Sessões

As sessões são armazenadas em um `Map` JavaScript no processo Node.js.

**Implicações:**
- Simples e sem dependência externa.
- **Não persistem** entre reinicializações do servidor — todos os usuários precisam logar novamente.
- **Não escalam** horizontalmente — múltiplas instâncias não compartilham sessões.

Para produção, substituir por sessões em **Redis** ou tabela de sessões no PostgreSQL.

---

## Arquivos estáticos

O servidor serve qualquer arquivo existente dentro de `src/public/` usando o path da URL:

```
GET /css/styles.css      →  src/public/css/styles.css
GET /js/auth.js          →  src/public/js/auth.js
GET /js/fornecedores.js  →  src/public/js/fornecedores.js
GET /swagger.json        →  src/public/swagger.json
```

O Content-Type é inferido pela extensão do arquivo (`.css`, `.js`, `.json`, `.html`).

---

## Skills Claude Code

O projeto possui skills registradas em `.claude/skills/` que governam como o Claude Code deve se comportar ao trabalhar neste repositório.

| Skill | Trigger | O que faz |
|-------|---------|-----------|
| `context-recovery` | Nova sessão / contexto perdido | Lê documentos na ordem certa, verifica git e arquivos reais antes de qualquer ação |
| `frontend-layout-system` | Criar ou alterar HTML/CSS/JS | Impõe padrão visual: cores, layout, componentes, acessibilidade, responsividade |
| `criar-funcao-com-teste` | Criar função JavaScript nova | Garante que a função venha acompanhada de teste simples |

---

## Pendências e limitações conhecidas

| Item | Impacto | Solução sugerida |
|------|---------|------------------|
| Sessões em memória | Perdidas ao reiniciar; não escalam | Redis ou tabela `sessoes` no PostgreSQL |
| Pool Python sem reuso | Uma conexão por request | `ThreadedConnectionPool` do psycopg2 |
| CNPJ sem validação de formato | Aceita qualquer string | Validação no Python + máscara no frontend |
| `usuarios.test.js` desatualizado | Testes não cobrem senha/role | Reescrever para a versão atual |
| Sem paginação | Listagens crescem indefinidamente | Parâmetros `?limit` e `?offset` nas rotas |
| Python porta 3001 exposta | Acesso sem auth possível em ambiente compartilhado | Bind em `127.0.0.1` ou firewall |

---

## Estrutura futura esperada

### Frontend

```
src/public/
  pages/            → novas telas (dashboard, relatórios, pedidos)
  css/
    styles.css      → design system (atual)
    dashboard.css   → estilos específicos de tela
  js/
    auth.js         → compartilhado (atual)
    clientes.js     → (atual)
    usuarios.js     → (atual)
    fornecedores.js → (atual)
  assets/
    images/         → logos, ícones
```

### Backend Node.js

```
src/
  routes/
    auth.js         → handlers de login/logout/me
    usuarios.js     → handlers do CRUD de usuários
    clientes.js     → handlers do CRUD de clientes
    fornecedores.js → proxy para Python
  middlewares/
    autenticar.js   → verificação de sessão
    autorizar.js    → verificação de role
  models/
    usuarios.js     → queries SQL
    clientes.js     → queries SQL
```

### Backend Python

```
src/
  fornecedores_api.py   → (atual — adequado para laboratório)

  Para produção:
  app/
    routes/fornecedores.py
    models/fornecedores.py
    db.py  → pool de conexões
  wsgi.py  → Gunicorn/uWSGI
```
