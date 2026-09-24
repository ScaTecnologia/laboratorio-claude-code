# Roteiro Prático: Implementando CI/CD no projeto `laboratorio-claude-code` com Claude Code

> Pré-requisito conceitual: leia `docs/DEVOPS_GUIA.md` primeiro. Este roteiro aplica aqueles conceitos neste projeto, usando **GitHub Actions**.
>
> Este documento descreve exatamente o que foi implementado neste repositório nesta sessão de estudo, para que você reproduza o raciocínio em outros projetos.

---

## Passo 0 — Pré-requisitos

- Conta no GitHub.
- Git instalado e configurado localmente (`git config --global user.name/user.email`).
- Claude Code configurado neste projeto (já está — veja `.claude/`).
- Node.js 22+ e Python 3.10+ instalados (compatível com o que já roda localmente).

---

## Passo 1 — Criar o repositório remoto e conectar

O projeto já é um repositório git local (`git status` funciona), mas **sem remote configurado**. Para ativar Actions, ele precisa estar no GitHub.

```bash
# 1. Crie um repositório vazio no GitHub (via site ou gh CLI)
gh repo create laboratorio-claude-code --private --source=. --remote=origin

# 2. Ou, se preferir pelo site: crie o repo no GitHub.com e depois:
git remote add origin https://github.com/<seu-usuario>/laboratorio-claude-code.git
git branch -M main
git push -u origin main
```

> Peça ao Claude Code para revisar o que vai subir antes do primeiro push: `git status`, `.gitignore` (garanta que `node_modules/`, `.env`, `*.log` estão ignorados).

### Prompt sugerido para o Claude Code nesta etapa

```
Antes de eu fazer o primeiro push deste projeto para o GitHub, revise o
.gitignore e confirme que nenhum segredo, credencial ou arquivo grande
desnecessário (logs, node_modules, zips) será versionado. Liste o que
encontrar antes de eu confirmar.
```

---

## Passo 2 — Proteger a branch principal

No GitHub: **Settings → Branches → Branch protection rules** para `main`:

- Exigir Pull Request antes de merge (mínimo 1 aprovação).
- Exigir que os checks de CI passem antes do merge (`Require status checks to pass` — marque os jobs do `ci.yml` depois que rodarem uma vez).
- Bloquear push direto na `main`.

Isso implementa a prática "nunca há código em produção que não passou pela esteira", pilar central de DevOps.

---

## Passo 3 — Preparar o código para ter algo que a esteira valide

Antes do pipeline, é preciso ter lint e testes executáveis por linha de comando (não manualmente). Isso já foi adicionado ao projeto nesta sessão:

| Arquivo adicionado | Função |
|---|---|
| `.eslintrc.json` | Regras de lint para o JavaScript (`src/**/*.js`) |
| `.flake8` | Regras de lint para o Python (`src/fornecedores_api.py`) |
| `requirements-dev.txt` | Dependências de desenvolvimento Python (flake8, pytest, bandit) |
| `package.json` (atualizado) | `devDependencies` (eslint) e scripts `lint`, `test:unit`, `test:integration` |
| `tests/test_fornecedores_api.py` | Teste unitário Python para `validar_cnpj` (função pura, sem banco) |

Scripts padronizados (rodados manualmente e pela esteira):

```bash
npm run lint            # ESLint no código Node
npm run test:unit       # Testes que não dependem de serviços externos (soma.test.js)
npm run test:integration  # Testes que dependem de Postgres/Redis/Mongo

flake8 src/ tests/ --config=.flake8         # Lint Python
pytest tests/ -v                             # Testes Python
```

### Prompt sugerido

```
Rode `npm run lint` e `npm run test:unit` agora e me mostre a saída.
Se algo falhar, explique o motivo antes de corrigir.
```

---

## Passo 4 — Criar o workflow de CI (`.github/workflows/ci.yml`)

Esse é o arquivo central. Ele foi criado com os seguintes jobs, em ordem de execução (jobs independentes rodam em paralelo; os que dependem de outro usam `needs:`):

1. **`lint-node`** — `npm ci` + `npm run lint`.
2. **`lint-python`** — `pip install -r requirements-dev.txt` + `flake8`.
3. **`test-unit`** — depende de `lint-node`; roda `npm run test:unit`, ou seja, `soma.test.js` (função pura) e `teste_mongo.js` — este último não precisa de MongoDB real: `src/mongo.js` é um **adaptador em memória** (ver comentário no topo do arquivo), então o teste roda sem nenhum serviço externo.
4. **`test-integration`** — depende de `test-unit`; sobe um **serviço de banco** (`services: postgres`) usando o container oficial do Docker Hub *gerenciado pelo próprio runner do GitHub* (isso não é "usar Docker na sua máquina" — é a infraestrutura do GitHub, então não conflita com a restrição da Unisys); roda `npm run test:integration`, ou seja, `usuarios.test.js` e `teste_redis.js` (este último também usa Redis em memória via `src/redis.js`, mas depende do Postgres real para os módulos de produtos/estoque/carrinho).
5. **`security-scan`** — `npm audit --audit-level=high`, `pip-audit`, `bandit -r src/`.
6. **`test-python-unit`** — `pytest tests/`.

Gatilhos (`on:`): `push` para qualquer branch e `pull_request` para `main` — assim toda PR é validada antes do merge (reforça a proteção de branch do Passo 2).

> Ver o arquivo completo em `.github/workflows/ci.yml`.

### Por que separar lint/test/security em jobs distintos?

- **Falha rápido**: lint é o mais barato e rápido — se falhar, você sabe em segundos, sem esperar testes de integração.
- **Paralelismo**: `lint-node` e `lint-python` rodam ao mesmo tempo, reduzindo o tempo total da esteira (métrica DORA: Lead Time).
- **Clareza no PR**: cada job aparece separado na tela do GitHub — fica óbvio *o que* falhou.

### Prompt sugerido para evoluir o pipeline

```
Adicione ao workflow ci.yml um job de cache de dependências npm/pip para
acelerar as próximas execuções, sem quebrar os jobs existentes. Explique
o que vai mudar antes de aplicar.
```

---

## Passo 5 — Configurar Secrets (quando necessário)

Nenhum secret é necessário para o `ci.yml` atual (os serviços de banco no CI usam credenciais fixas de teste, não credenciais reais). Quando o projeto precisar (ex.: deploy real, chave de API externa):

**Settings → Secrets and variables → Actions → New repository secret.**

Nunca commitar segredos em `.env` ou no YAML — o hook `security-guardrail.js` já bloqueia edições em `.env` neste projeto (regra herdada do `CLAUDE.md`).

---

## Passo 6 — Segurança contínua (DevSecOps)

Além do `security-scan` no `ci.yml`, é recomendado habilitar (gratuito em repositórios GitHub):

- **Dependabot** (`Settings → Code security → Dependabot alerts` + `Dependabot version updates`): abre PR automático quando uma dependência tem vulnerabilidade conhecida.
- **CodeQL** (`Settings → Code security → Code scanning → CodeQL`): SAST nativo do GitHub, detecta padrões inseguros (SQL injection, XSS) automaticamente em JS/Python.
- **Secret scanning**: já ligado por padrão em repositórios privados de organizações GitHub Enterprise; verifique se está ativo em `Settings → Code security`.

Isso reforça, em nível de plataforma, o que o hook `security-guardrail.js` já faz em nível de edição de arquivo — defesa em profundidade.

---

## Passo 7 — CD com contêiner (Docker) — pronto, porém **inativo**

Como as máquinas da Unisys usadas neste treinamento não permitem Docker, os artefatos foram criados **prontos para uso futuro em outra máquina**, mas configurados para **nunca rodar automaticamente**:

| Arquivo | Conteúdo |
|---|---|
| `Dockerfile` | Imagem para o serviço Node (`src/server.js`) |
| `Dockerfile.python` | Imagem para a API Python (`src/fornecedores_api.py`) |
| `docker-compose.yml` | Orquestra Node + Python + Postgres localmente (Redis/Mongo são adaptadores em memória, não precisam de serviço) |
| `.github/workflows/docker-build.yml` | Workflow de build → scan → publish → deploy — gatilho **somente `workflow_dispatch`** (disparo manual pela aba Actions), nunca em `push`/`pull_request` |

O `docker-build.yml` tem 5 jobs, na ordem em que dados fluem entre eles (`needs:`):

1. **`build-node` / `build-python`** — constrói as imagens e as salva como artifact do workflow (não publica ainda).
2. **`scan-node` / `scan-python`** — roda **Trivy** em cada imagem, procurando vulnerabilidades `CRITICAL`/`HIGH`. Se achar, o job falha e **nada depois dele roda** — nem publish, nem deploy. Esta é a camada de segurança da informação sobre os *containers*, equivalente ao `security-scan` do `ci.yml` para o código-fonte.
3. **`publish`** (opcional, `push_image: true`) — só roda se as duas imagens passaram no scan; publica no GitHub Container Registry (`ghcr.io`).
4. **`deploy-production`** (opcional, `deploy_production: true`) — só roda se as duas imagens passaram no scan **e** um revisor humano aprovar, porque o job usa `environment: production`, um **GitHub Environment protegido** (configure em `Settings → Environments → New environment → production → Required reviewers`). Sem essa aprovação, o job fica parado esperando — de propósito. Os comandos de deploy em si estão como placeholder (`echo`), já que este laboratório não tem servidor de produção real; em um projeto real, substituiria por SSH/kubectl/action do provedor de nuvem.

Esse é o "portão de segurança" que impede uma imagem vulnerável, ou um deploy não autorizado por ninguém, de chegar em produção — mesmo com o gatilho sendo manual.

### Como habilitar quando estiver em uma máquina com Docker permitido

1. Localmente: `docker compose up --build` para validar que sobe tudo.
2. No GitHub: aba **Actions → docker-build → Run workflow** (disparo manual) para testar o build em CI sem alterar o gatilho.
3. Só depois de validado manualmente algumas vezes, se desejar automatizar, edite `on:` em `docker-build.yml` adicionando `push: { branches: [main] }` — **decisão consciente, não faça isso enquanto estiver em máquina sem permissão de Docker.**

### Prompt sugerido para essa etapa (em outra máquina)

```
Estou em uma máquina onde Docker é permitido. Rode `docker compose up --build`,
verifique se os 5 serviços sobem (node, python, postgres, redis, mongo) e me
avise se algum falhar, explicando a causa antes de tentar corrigir.
```

---

## Passo 8 — Usando os artefatos do Claude Code no dia a dia da esteira

Este projeto ganhou 3 novos artefatos (detalhados também em `docs/PROMPT_INICIAL_PROJETO.md`):

| Artefato | Caminho | Uso |
|---|---|---|
| Skill | `.claude/skills/cicd-pipeline/SKILL.md` | Ativa quando você pede para criar/alterar workflows, Dockerfile, ou configurar lint/testes de CI |
| Agente | `.claude/agents/devops-engineer.md` | Subagente especializado em revisar/propor pipelines e infraestrutura, sem aplicar mudanças sem autorização |
| Hook | `.claude/hooks/pipeline-guardrail.js` (registrado em `.claude/settings.json`) | Bloqueia deterministicamente qualquer edição que reative o gatilho automático do `docker-build.yml` |

### Fluxo recomendado de uso

1. Peça mudanças de pipeline em linguagem natural — a skill `cicd-pipeline` guia o Claude Code a seguir o padrão já estabelecido (jobs separados, sem segredos hardcoded, sem push automático de Docker).
2. Para decisões arquiteturais maiores (nova plataforma de CI, nova estratégia de deploy), invoque o agente: *"use o agente devops-engineer para avaliar se deveríamos migrar para Azure Pipelines"*.
3. O hook `pipeline-guardrail.js` age como rede de segurança: mesmo que você ou o Claude Code esqueçam a regra do Passo 7, a edição que reativasse o Docker automático é bloqueada e explicada.

---

## Passo 9 — Acompanhar métricas DORA neste projeto (mesmo em escala pequena)

Você não precisa de uma ferramenta de APM para começar a medir:

| Métrica DORA | Como aproximar no GitHub, de graça |
|---|---|
| Deployment Frequency | Contar quantos merges em `main` por semana (`git log main --since="1 week ago" --oneline \| wc -l`) |
| Lead Time for Changes | Tempo entre abertura do PR e merge (`gh pr list --state merged --json createdAt,mergedAt`) |
| Change Failure Rate | % de PRs revertidos ou que geraram hotfix logo depois |
| Recovery Time | Tempo entre um workflow falhar em `main` e o próximo passar |

### Prompt sugerido

```
Gere um script Node simples (src/scripts/dora-metrics.js) que usa `gh` CLI
para calcular Deployment Frequency e Lead Time for Changes dos últimos 30
dias neste repositório, e explique como interpretar o resultado.
```

---

## Passo 10 — Trabalhando em equipe: backlog, branches e conflitos

Tudo acima cobre a esteira para **um** desenvolvedor. Na prática, vários devs usam o mesmo repositório ao mesmo tempo — isso tem sua própria documentação dedicada, pois envolve regras adicionais de governança (quem revisa o quê) e um problema técnico específico (conflitos de merge):

| Documento | Conteúdo |
|---|---|
| `docs/BACKLOG_KANBAN.md` | Board Kanban (GitHub Projects): como o backlog fica visível para todo o time e como uma tarefa vira uma branch |
| `docs/COLABORACAO_EQUIPE.md` | Branching (branches curtas, uma por tarefa), CODEOWNERS, branch protection, o que é e como se resolve um conflito de merge |
| `docs/EXERCICIO_MULTIPLOS_DEVS.md` | Exercício prático — 2 devs, mesmo arquivo, conflito real gerado e resolvido, com todos os comandos e saídas reais |

Configuração adicional no GitHub necessária para este fluxo funcionar (além da proteção de branch do Passo 2):

1. **CODEOWNERS** (arquivo `CODEOWNERS` na raiz, já criado) — em `Settings → Branches`/`Rules`, marque "Require review from Code Owners" para que o GitHub exija a aprovação certa por área do código.
2. **Templates de Issue** (`.github/ISSUE_TEMPLATE/tarefa.yml` e `bug.yml`, já criados) — aparecem automaticamente ao clicar em "New issue" no GitHub.
3. **Template de Pull Request** (`.github/pull_request_template.md`, já criado) — preenche automaticamente a descrição de todo PR novo.
4. **Board do Projects** — siga `docs/BACKLOG_KANBAN.md` para criar as colunas e ligar a automação (issue atribuída → move sozinha para "Em Progresso", etc.).
5. **Ambiente `production`** (usado pelo Passo 7 / `docker-build.yml`) — `Settings → Environments → New environment → production` → adicione "Required reviewers".

### Prompt sugerido para praticar

```
Quero simular que sou um segundo desenvolvedor neste projeto. Crie uma
branch a partir da main chamada feature/999-exemplo, faça uma pequena
mudança em um arquivo diferente do que eu estou mexendo agora, e me
mostre como abriria o Pull Request — sem de fato mexer na minha branch
atual nem na main.
```

## Checklist final

- [ ] Repositório no GitHub com branch `main` protegida
- [ ] `npm run lint` e `flake8` passam localmente
- [ ] `.github/workflows/ci.yml` passa em um PR de teste
- [ ] Dependabot e CodeQL habilitados
- [ ] `docker-build.yml` existe, mas **não** dispara em push/PR
- [ ] Job de scan (Trivy) roda antes de qualquer publish/deploy no `docker-build.yml`
- [ ] Ambiente `production` criado com "Required reviewers" configurado
- [ ] Skill, agente e hook de CI/CD presentes em `.claude/`
- [ ] CODEOWNERS presente e "Require review from Code Owners" habilitado
- [ ] Templates de Issue e Pull Request aparecem ao criar um novo
- [ ] Board Kanban criado e ligado às Issues (`docs/BACKLOG_KANBAN.md`)
- [ ] `CLAUDE.md` atualizado citando os novos artefatos

---

## Próximos passos de aprendizado (fora do escopo deste laboratório)

- Kubernetes + GitOps (ArgoCD) para orquestração em produção real.
- Observabilidade completa (Prometheus + Grafana + OpenTelemetry).
- Infra as Code (Terraform) para provisionar o banco/ambiente em vez de assumir `localhost:5151`.
