# Roteiro Prático: Implementando CI/CD no projeto `laboratorio-claude-code` com Claude Code

> Pré-requisito conceitual: leia `docs/DEVOPS_GUIA.md` primeiro. Este roteiro aplica aqueles conceitos neste projeto, usando **GitHub Actions**.
>
> Este documento descreve exatamente o que foi implementado neste repositório nesta sessão de estudo, para que você reproduza o raciocínio em outros projetos.

---

## Passo 0 — Pré-requisitos

- Conta no GitHub.
- Git instalado e configurado localmente (`git config --global user.name/user.email`).
- Claude Code configurado neste projeto (já está — veja `.claude/`).
- Node.js 22+ e Python 3.13+ instalados (compatível com o que já roda localmente).

---

## Passo 1 — Criar o repositório remoto e conectar

O projeto já é um repositório git local (`git status` funciona), mas **sem remote configurado**. Para ativar Actions, ele precisa estar no GitHub.

```bash
# 1. Crie um repositório vazio no GitHub (via site ou gh CLI)
gh repo create ScaTecnologia/laboratorio-claude-code --public --source=. --remote=origin

# 2. Ou, se preferir pelo site: crie o repo no GitHub.com e depois:
git remote add origin git@github.com:ScaTecnologia/laboratorio-claude-code.git
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

**Como foi feito neste laboratório** (via `gh api`, ruleset **"Proteger main"** — `Settings → Rules → Rulesets`): PR obrigatório com 1 aprovação de code owner, 8 checks obrigatórios (6 jobs do `ci.yml` + os 2 scans Trivy), sem force-push e sem deleção da `main`. Enquanto só existe uma conta, o **admin pode dispensar a aprovação** no merge (`gh pr merge --admin`) — o push direto continua bloqueado. Quando entrar o 2º dev, remova esse bypass no ruleset.

> ⚠ Em repositório **privado** de conta pessoal **Free**, rulesets e Required reviewers de Environment **não são aplicados**. Por isso o repositório é público.

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
4. **`test-integration`** — depende de `test-unit`; sobe um **serviço de banco** (`services: postgres`) usando o container oficial do Docker Hub *gerenciado pelo próprio runner do GitHub* (é infraestrutura do GitHub, independente de haver Docker na sua máquina); roda `npm run test:integration`, ou seja, `usuarios.test.js` e `teste_redis.js` (este último também usa Redis em memória via `src/redis.js`, mas depende do Postgres real para os módulos de produtos/estoque/carrinho).
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

## Passo 7 — CD com contêiner (Docker) — **ativo**

> Histórico: nas máquinas Unisys do início do treinamento o Docker não era permitido, então estes artefatos nasceram "prontos, porém inativos" (gatilho só manual). Em 2026-09-24, numa máquina Linux com Docker, eles foram **ativados e validados de verdade** — o que está descrito abaixo é o estado atual.

| Arquivo | Conteúdo |
|---|---|
| `Dockerfile` | Imagem do serviço Node (`src/server.js`), multi-stage, usuário não-root, **sem npm no runtime** |
| `Dockerfile.python` | Imagem da API Python (`src/fornecedores_api.py`), usuário não-root, **sem pip/setuptools/wheel no runtime** |
| `docker-compose.yml` | Orquestra Postgres + Node + Python localmente (Redis/Mongo são adaptadores em memória, não precisam de serviço) |
| `.github/workflows/docker-build.yml` | Build → scan → publish → deploy |

### 7.1 Rodando localmente

```bash
docker compose up --build -d     # sobe postgres (5151), node (3000) e fornecedores (3001)
docker compose ps                # os 3 devem estar "Up"
docker compose logs -f node      # logs
docker compose down              # derruba (dados do Postgres ficam no volume)
```

Três ajustes foram necessários para o compose funcionar (e valem para qualquer projeto):

1. **Nada de `localhost` fixo no código.** Dentro de um container, `localhost` é o próprio container. Host/porta passaram a vir de variáveis de ambiente, com padrão `localhost` (então rodar sem Docker continua igual): `DB_HOST`/`DB_PORT` (Node e Python), `FORNECEDORES_HOST`/`FORNECEDORES_PORT` (proxy Node → Python) e `FLASK_HOST`. No compose, os serviços se enxergam pelo nome: `DB_HOST=postgres`, `FORNECEDORES_HOST=fornecedores`.
2. **Flask precisa escutar em `0.0.0.0` dentro do container** (`FLASK_HOST=0.0.0.0`), senão a porta publicada não responde.
3. **Publicar só o necessário.** Postgres e a API Python (que não tem autenticação) são publicados apenas em `127.0.0.1`; só o Node (3000) fica acessível na rede.

### 7.2 O workflow `docker-build.yml`

| Evento | O que roda |
|---|---|
| `push` / `pull_request` na `main` | **Automático:** build das 2 imagens + scan Trivy |
| `workflow_dispatch` (aba Actions → Run workflow) | Build + scan e, se marcado nos inputs, publish no GHCR e/ou deploy |

Jobs, na ordem em que dados fluem entre eles (`needs:`):

1. **`build-node` / `build-python`** — constrói as imagens e as salva como artifact do workflow.
2. **`scan-node` / `scan-python`** — **Trivy** (`aquasecurity/trivy-action`, **fixada pelo SHA do commit**, não pela tag) procura vulnerabilidades `CRITICAL`/`HIGH` **com correção disponível** (`ignore-unfixed: true`). Se achar, o job falha e nada depois dele roda. Os dois scans são **checks obrigatórios** da `main` (Passo 2).
3. **`publish`** (opcional) — publica no `ghcr.io`. Só com disparo manual e `push_image: true`.
4. **`deploy-production`** (opcional) — só com disparo manual, `deploy_production: true` **e** aprovação humana no GitHub Environment `production` (Required reviewers). Os comandos de deploy são placeholder (`echo`) — não há servidor de produção real neste laboratório.

**Regra de ouro:** build e scan podem ser automáticos; **publicar e fazer deploy, nunca**. Os jobs `publish` e `deploy-production` têm `if: github.event_name == 'workflow_dispatch' && ...`, e o hook `.claude/hooks/pipeline-guardrail.js` bloqueia qualquer edição do Claude Code que remova essa trava.

### 7.3 Lições aprendidas ao ativar

- **Scan quebrou no primeiro PR — e isso é bom.** As CVEs estavam em ferramentas que vêm na imagem base e o app não usa em runtime (npm na imagem Node; pip/setuptools/wheel na Python). A correção foi **remover essas ferramentas da imagem final**, não afrouxar o scan.
- **CVEs sem correção** (pacotes do SO da imagem base ainda sem patch) são ignoradas com `ignore-unfixed: true`: o scan barra só o que dá para resolver.
- **Tags de action podem sumir ou ser reapontadas.** A `trivy-action@0.24.0` deixou de existir (as tags foram recriadas com prefixo `v` após um incidente de cadeia de suprimentos). Fixar pelo SHA do commit evita as duas coisas.
- Para reproduzir o scan do CI localmente:
  ```bash
  docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:0.70.0 \
    image --severity CRITICAL,HIGH --ignore-unfixed --exit-code 1 <imagem>
  ```

### Prompt sugerido para essa etapa

```
Rode `docker compose up --build -d`, confirme que os 3 serviços sobem e que
login, clientes e fornecedores funcionam em http://localhost:3000. Depois rode
o mesmo scan Trivy do CI nas duas imagens e, se algo falhar, explique a causa
antes de corrigir — sem afrouxar o scan.
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

- [x] Repositório no GitHub com branch `main` protegida
- [x] `npm run lint` e `flake8` passam localmente
- [x] `.github/workflows/ci.yml` passa em um PR de teste
- [x] Dependabot (alerts, security updates e `.github/dependabot.yml`) e CodeQL habilitados
- [x] Workflows declaram `permissions: contents: read` (menor privilégio — exigido pelo CodeQL)
- [x] `docker-build.yml` roda build + scan em push/PR; publish/deploy só manual
- [x] Job de scan (Trivy) roda antes de qualquer publish/deploy no `docker-build.yml`
- [x] Ambiente `production` criado com "Required reviewers" configurado
- [x] Skill, agente e hook de CI/CD presentes em `.claude/`
- [x] CODEOWNERS presente e "Require review from Code Owners" habilitado
- [x] Templates de Issue e Pull Request aparecem ao criar um novo
- [x] Board Kanban criado e ligado às Issues (`docs/BACKLOG_KANBAN.md`)
- [x] `CLAUDE.md` atualizado citando os novos artefatos

---

## Próximos passos de aprendizado (fora do escopo deste laboratório)

- Kubernetes + GitOps (ArgoCD) para orquestração em produção real.
- Observabilidade completa (Prometheus + Grafana + OpenTelemetry).
- Infra as Code (Terraform) para provisionar o banco/ambiente em vez de assumir `localhost:5151`.
