# Instruções do projeto — LabSystem

> **Nova sessão do Claude Code, ou retomando depois de um tempo?** Leia `docs/STATUS_LABORATORIO.md` antes de propor qualquer implementação — ele diz o que já foi feito, o que falta e os próximos passos concretos. A skill `context-recovery` já lê esse arquivo primeiro.

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

# Subir tudo com Docker (Postgres + Node + API Python) — alternativa aos 2 comandos abaixo
docker compose up --build -d
docker compose down            # derruba (dados do Postgres ficam no volume)

# Iniciar o servidor Node.js (porta 3000)
node src/server.js

# Iniciar a API Python de Fornecedores (porta 3001) — terminal separado
python src/fornecedores_api.py

# Rodar testes
node src/soma.test.js
node src/usuarios.test.js   # requer banco PostgreSQL ativo

# Lint e testes usados pela esteira de CI/CD (GitHub Actions)
npm run lint                # ESLint (Node)
npm run test:unit           # sem dependências externas (soma + mongo em memória)
npm run test:integration    # requer PostgreSQL ativo (usuarios + redis)
flake8 src/ tests/ --config=.flake8   # lint Python
pytest tests/ -v                      # testes Python (validar_cnpj)
bandit -r src/ -q                     # SAST Python
```

## CI/CD

- Pipeline ativo: `.github/workflows/ci.yml` (lint, testes unitários/integração, scan de segurança) — roda em todo push e PR.
- Pipeline Docker: `.github/workflows/docker-build.yml` — build + scan (Trivy, `ignore-unfixed`) rodam **automaticamente** em push/PR na `main`; publish no GHCR e deploy em produção rodam **só manualmente** (`workflow_dispatch`, deploy exige aprovação humana no GitHub Environment `production`). O hook `pipeline-guardrail.js` bloqueia qualquer edição que deixe publish/deploy automáticos.
- Docker **ativo** nesta máquina (Linux): `docker compose up --build -d` sobe Postgres (5151, só localhost) + Node (3000) + API Python (3001, só localhost). Host/porta vêm de variáveis de ambiente (`DB_HOST`, `DB_PORT`, `FORNECEDORES_HOST`, `FORNECEDORES_PORT`, `FLASK_HOST`) com padrão `localhost`, então rodar sem Docker continua funcionando igual. Não rode Postgres local na 5151 e o compose ao mesmo tempo.
- Teoria e passo a passo completos: `docs/DEVOPS_GUIA.md` e `docs/ROTEIRO_CICD_CLAUDE_CODE.md`.

## Trabalho em equipe (vários devs no mesmo repositório)

- Backlog e board Kanban: `docs/BACKLOG_KANBAN.md` + `.github/ISSUE_TEMPLATE/` (tarefa e bug).
- Branching, revisão obrigatória (CODEOWNERS) e branch protection: `docs/COLABORACAO_EQUIPE.md`.
- Exercício prático de conflito de merge entre 2 devs, resolvido passo a passo com comandos reais: `docs/EXERCICIO_MULTIPLOS_DEVS.md`.
- Template de Pull Request: `.github/pull_request_template.md`. Dono de cada área do código: `CODEOWNERS`.

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
| `cicd-pipeline` | Ao criar/alterar workflows, Dockerfile, docker-compose ou config de lint/testes de CI |

## Agentes disponíveis

| Agente | Quando usar |
|--------|-------------|
| `code-reviewer` | Revisar qualidade de código JavaScript |
| `devops-engineer` | Avaliar/propor pipelines, infraestrutura e estratégias de deploy (não aplica mudanças sozinho) |

## Documentação do projeto

| Arquivo | Conteúdo |
|---------|----------|
| `docs/STATUS_LABORATORIO.md` | **Ler primeiro em toda nova sessão.** Onde paramos, pendências, próximos passos, problemas conhecidos do ambiente |
| `docs/SETUP_NOVA_MAQUINA.md` | Como levar este laboratório para outra máquina: pré-requisitos, instalação, verificação |
| `docs/PROJECT_CONTEXT.md` | O que foi construído, rotas, banco, credenciais |
| `docs/ARCHITECTURE.md` | Camadas, fluxos, segurança, diagramas |
| `DOCS.md` | Descrição técnica de cada arquivo do projeto |
| `requirements.txt` | Dependências Python (Flask + psycopg2-binary) |
| `requirements-dev.txt` | Dependências Python de desenvolvimento/CI (flake8, pytest, bandit, pip-audit) |
| `docs/DEVOPS_GUIA.md` | O que é DevOps, práticas, arquiteturas e ferramentas de mercado |
| `docs/ROTEIRO_CICD_CLAUDE_CODE.md` | Passo a passo de como a esteira de CI/CD deste projeto foi implementada |
| `docs/PROMPT_INICIAL_PROJETO.md` | Prompt-modelo para iniciar novos projetos já com CI/CD pensado |
| `docs/COLABORACAO_EQUIPE.md` | Como vários devs trabalham no mesmo repo sem se atropelar: branches, PRs, CODEOWNERS, conflitos |
| `docs/EXERCICIO_MULTIPLOS_DEVS.md` | Exercício prático (comandos reais) simulando 2 devs e um conflito de merge, do início ao fim |
| `docs/BACKLOG_KANBAN.md` | Como configurar e usar o board Kanban (GitHub Projects) para o backlog de tarefas |
| `docs/SIMULANDO_2_DEVS.md` | Simular 2 devs na mesma máquina: pastas `~/devs/dev1` e `~/devs/dev2`, cada uma com seus containers e portas (`portas.env`) |
