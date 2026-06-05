# Instruções do projeto — LabSystem

## Stack
- Node.js (CommonJS) — sem frameworks, apenas módulos nativos
- Python 3 + Flask — backend do CRUD de Fornecedores (porta 3001)
- JavaScript puro no frontend (HTML + CSS + Fetch API)
- PostgreSQL — `localhost:5151` — banco `laboratorio`
- Driver Node: `pg` (node-postgres)
- Driver Python: `psycopg2-binary`

## Comandos

```bash
# Instalar dependências Node.js
npm install

# Instalar dependências Python
pip install -r requirements.txt

# Iniciar o servidor Node.js (porta 3000)
node src/server.js

# Iniciar a API Python de Fornecedores (porta 3001) — terminal separado
python src/fornecedores_api.py

# Rodar testes
node src/soma.test.js
node src/usuarios.test.js   # requer banco PostgreSQL ativo
```

## URLs

| URL | Descrição |
|-----|-----------|
| `http://localhost:3000` | Landing page comercial |
| `http://localhost:3000/login.html` | Login |
| `http://localhost:3000/clientes.html` | CRUD Clientes |
| `http://localhost:3000/fornecedores.html` | CRUD Fornecedores |
| `http://localhost:3000/usuarios.html` | CRUD Usuários (Admin) |
| `http://localhost:3000/api-docs` | Swagger UI |
| `http://localhost:3001/fornecedores` | API Python direta (não usar no browser — sem auth) |

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
| `DOCS.md` | Descrição técnica de cada arquivo do projeto |
| `requirements.txt` | Dependências Python (Flask + psycopg2-binary) |
