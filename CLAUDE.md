# Instruções do projeto — LabSystem

## Stack
- Node.js (CommonJS) — sem frameworks, apenas módulos nativos
- JavaScript puro no frontend (HTML + CSS + Fetch API)
- PostgreSQL — `localhost:5151` — banco `laboratorio`
- Driver: `pg` (node-postgres)

## Comandos

```bash
# Iniciar a aplicação
node src/server.js

# Rodar testes
node src/soma.test.js
node src/usuarios.test.js   # requer banco PostgreSQL ativo

# Instalar dependências
npm install
```

## URLs

| URL | Descrição |
|-----|-----------|
| `http://localhost:3000` | Aplicação (redireciona por auth) |
| `http://localhost:3000/login.html` | Login |
| `http://localhost:3000/clientes.html` | CRUD Clientes |
| `http://localhost:3000/usuarios.html` | CRUD Usuários (Admin) |
| `http://localhost:3000/api-docs` | Swagger UI |

## Regras
- Antes de alterar código, explique o plano.
- Não instalar bibliotecas sem justificar.
- Não alterar `.env`.
- Manter código simples.
- Sempre explicar como testar.
- Nunca retornar o campo `senha` nas respostas da API.
- Queries SQL sempre parametrizadas (`$1`, `$2`...) — nunca interpolação de string.
- Proteção de rotas sempre no servidor — nunca confiar só no frontend.

## Credenciais padrão (desenvolvimento)

| Campo | Valor |
|-------|-------|
| Email | `Alexaugusto2@gmail.com` |
| Senha | `admin123` |
| Role  | `Admin` |

## Skills disponíveis

| Skill | Quando usar |
|-------|-------------|
| `context-recovery` | Ao iniciar nova sessão ou após perda de contexto |
| `frontend-layout-system` | Ao criar ou alterar qualquer página HTML/CSS/JS |
| `criar-funcao-com-teste` | Ao criar nova função JavaScript com teste |

## Documentação do projeto

| Arquivo | Conteúdo |
|---------|----------|
| `docs/PROJECT_CONTEXT.md` | O que foi construído, rotas, banco, credenciais |
| `docs/ARCHITECTURE.md` | Camadas, fluxos, segurança, diagramas |
| `DOCS.md` | Descrição técnica de cada arquivo |
