# ARCHITECTURE.md

Documento de arquitetura do **LabSystem** — decisões estruturais, camadas, fluxos e componentes.

---

## Visão geral

O LabSystem é uma aplicação **monolítica** com três camadas bem definidas: frontend estático, servidor HTTP e banco de dados relacional. Não usa frameworks — apenas módulos nativos do Node.js e o driver `pg`.

```
┌─────────────────────────────────────────────────────────────┐
│                        NAVEGADOR                            │
│                                                             │
│   login.html   clientes.html   usuarios.html   api-docs     │
│       │              │               │              │        │
│   login.js    clientes.js     usuarios.js     swagger-ui    │
│       └──────────────┴───────────────┘              │        │
│                      auth.js                        │        │
│                         │                           │        │
│              fetch() — HTTP/1.1                     │        │
└─────────────────────────────────────────────────────────────┘
                          │
                     Cookie: sessao_id (HttpOnly)
                          │
┌─────────────────────────────────────────────────────────────┐
│                    SERVIDOR (Node.js)                       │
│                      src/server.js                          │
│                                                             │
│   ┌──────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│   │  Roteador │  │ Auth Helpers │  │  Arquivos estáticos │  │
│   │  HTTP     │  │ parseCookies │  │  src/public/        │  │
│   │           │  │ getSessao    │  │                     │  │
│   └─────┬─────┘  └──────┬───────┘  └─────────────────────┘  │
│         │               │                                   │
│   ┌─────▼───────────────▼────────────────────────┐          │
│   │              Handlers de Rota                │          │
│   │  /login  /logout  /me  /usuarios  /clientes  │          │
│   └─────────┬──────────────────────┬─────────────┘          │
│             │                      │                        │
│   ┌─────────▼──────┐    ┌──────────▼──────┐                 │
│   │  src/sessoes.js │    │  src/usuarios.js │                │
│   │  Map em memória │    │  src/clientes.js │                │
│   └─────────────────┘    └────────┬─────────┘                │
│                                   │                         │
│                          ┌────────▼────────┐                │
│                          │   src/db.js      │               │
│                          │   Pool pg        │               │
│                          └────────┬─────────┘               │
└───────────────────────────────────┼─────────────────────────┘
                                    │
┌───────────────────────────────────▼─────────────────────────┐
│              PostgreSQL — localhost:5151                     │
│                   banco: laboratorio                        │
│                                                             │
│        ┌──────────────┐        ┌──────────────┐            │
│        │   usuarios   │        │   clientes   │            │
│        └──────────────┘        └──────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

---

## Camadas

### Camada 1 — Frontend (Browser)

Páginas HTML estáticas servidas pelo próprio servidor Node.js a partir de `src/public/`. Toda interação com dados ocorre via `fetch()` chamando a API REST.

| Arquivo | Responsabilidade |
|---------|-----------------|
| `css/styles.css` | Design system: variáveis, layout, componentes, responsividade |
| `js/auth.js` | `verificarAuth()`, `configurarHeader()`, `logout()` — compartilhado por todas as páginas |
| `js/login.js` | Submissão do formulário de login |
| `js/usuarios.js` | CRUD de usuários no frontend |
| `js/clientes.js` | CRUD de clientes no frontend |

**Proteção no frontend:**
- Toda página protegida chama `verificarAuth()` ao carregar.
- `verificarAuth()` faz `GET /me`; se retornar 401, redireciona para `/login.html`.
- Se o role não for suficiente, redireciona para `/clientes.html`.
- O link "Usuários" no menu é ocultado via `[data-admin]` para não-Admin.

> O frontend é a primeira barreira de UX. A barreira de segurança real está na camada do servidor.

---

### Camada 2 — Servidor HTTP (Node.js)

`src/server.js` é o único ponto de entrada da aplicação. Não usa Express — o roteamento é feito manualmente por comparação de `url` e `method`.

#### Ordem de resolução de rotas

```
Requisição HTTP
      │
      ├─ GET /                → serve index.html
      ├─ GET /login.html      → serve login.html
      ├─ GET /api-docs        → serve swagger.html
      │
      ├─ POST /login          → autentica, cria sessão, define cookie
      ├─ POST /logout         → encerra sessão, limpa cookie
      ├─ GET  /me             → retorna usuário da sessão
      │
      ├─ /usuarios/*          → verifica sessão + role Admin → CRUD
      ├─ /clientes/*          → verifica sessão → CRUD
      │
      ├─ Arquivo em public/   → serve estático (CSS, JS, JSON...)
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

---

### Camada 3 — Módulos de Negócio

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

## Fluxo de uma requisição autenticada

```
fetch('/usuarios', { credentials: 'include' })
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
            sessao.role === 'Admin' ?
                  │
                  ├─ não  →  403 Acesso restrito
                  │
                  └─ sim
                       │
                       ▼
                 usuariosModule.listar()
                       │
                       ▼
                 pool.query('SELECT id, nome, email, role ...')
                       │
                       ▼
                 200 [{id, nome, email, role}, ...]
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
| Injeção de SQL | Queries parametrizadas (`$1`, `$2`) em todas as operações |
| XSS via tabela | `escHtml()` aplicado em todos os valores renderizados no DOM |

---

## Banco de dados

### Diagrama de tabelas

```
┌─────────────────────────────┐     ┌─────────────────────────────┐
│          usuarios           │     │           clientes          │
├─────────────────────────────┤     ├─────────────────────────────┤
│ id       SERIAL  PK         │     │ id       SERIAL  PK         │
│ nome     TEXT    NOT NULL   │     │ nome     TEXT    NOT NULL   │
│ email    TEXT    NOT NULL   │     │ endereco TEXT               │
│          UNIQUE             │     │ bairro   TEXT               │
│ senha    TEXT    NOT NULL   │     │ cidade   TEXT               │
│ role     TEXT    NOT NULL   │     │ estado   TEXT               │
│          DEFAULT 'Atendente'│     │ email    TEXT               │
└─────────────────────────────┘     │ telefone TEXT               │
                                    └─────────────────────────────┘
```

As tabelas não têm relacionamento entre si. Expansões futuras (ex: cliente atribuído a um atendente) exigiriam chave estrangeira.

### Pool de conexões

`db.js` exporta um único `Pool` do `pg`. O pool gerencia automaticamente múltiplas conexões simultâneas. Não há configuração explícita de tamanho — o padrão do `pg` é 10 conexões.

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
GET /css/styles.css  →  src/public/css/styles.css
GET /js/auth.js      →  src/public/js/auth.js
GET /swagger.json    →  src/public/swagger.json
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

## Estrutura futura esperada

Seguindo a skill `frontend-layout-system`, o projeto está preparado para evoluir para:

```
src/
  public/
    pages/          → novas telas (dashboard, relatórios, operações)
    css/
      styles.css    → design system (atual)
      dashboard.css → estilos específicos de tela
    js/
      auth.js       → compartilhado (atual)
      clientes.js   → (atual)
      usuarios.js   → (atual)
    assets/
      images/       → logos, ícones
```

E no backend, a evolução natural seria:

```
src/
  routes/
    auth.js         → handlers de login/logout/me
    usuarios.js     → handlers do CRUD de usuários
    clientes.js     → handlers do CRUD de clientes
  middlewares/
    autenticar.js   → verificação de sessão
    autorizar.js    → verificação de role
  models/
    usuarios.js     → queries SQL
    clientes.js     → queries SQL
```
