# Status do Laboratório — onde paramos e como continuar

> **Leia este arquivo primeiro, antes de qualquer outro documento.** Ele existe para que uma nova sessão do Claude Code (ou você, voltando depois de um tempo, ou em outra máquina) saiba em 1 minuto o que já foi feito, o que falta, e o que fazer a seguir — sem precisar reconstruir o histórico da conversa.
>
> Última atualização: 2026-09-24. Se você (Claude Code) alterar algo relevante ao estado do laboratório, **atualize este arquivo antes de terminar a sessão**.

---

## 1. O que é este laboratório

Um projeto Node.js + Python (LabSystem — CRUD de clientes/fornecedores/usuários) usado como base prática para aprender, na ordem em que foi construído:

1. Como o Claude Code funciona no dia a dia (skills, agentes, hooks) — trabalho de sessões anteriores, documentado em `docs/PROJECT_CONTEXT.md` e `DOCS.md`.
2. **DevOps e esteira de CI/CD** — o que é, boas práticas, e uma esteira real implementada com GitHub Actions.
3. **Trabalho em equipe na esteira** — como vários desenvolvedores usam o mesmo repositório sem destruir o trabalho uns dos outros, e o que é/como se resolve um conflito de merge.

As partes 2 e 3 são o trabalho mais recente (documentado abaixo) e ainda **não foram levadas para um repositório remoto real** — tudo existe localmente até agora.

---

## 2. O que já está pronto (não precisa refazer)

### Documentação (teoria + prático), em `docs/`

| Arquivo | Conteúdo |
|---|---|
| `DEVOPS_GUIA.md` (+ `.docx`) | O que é DevOps, CALMS, métricas DORA, ferramentas de mercado por etapa da esteira |
| `ROTEIRO_CICD_CLAUDE_CODE.md` (+ `.docx`) | Passo a passo de como a esteira de CI/CD deste projeto foi implementada |
| `PROMPT_INICIAL_PROJETO.md` | Prompt-modelo para começar outros projetos já com CI/CD pensado |
| `COLABORACAO_EQUIPE.md` (+ `.docx`) | Branching, CODEOWNERS, branch protection, o que é/como resolver conflito de merge |
| `EXERCICIO_MULTIPLOS_DEVS.md` (+ `.docx`) | Exercício prático com comandos reais: 2 devs, mesmo arquivo, conflito gerado e resolvido |
| `BACKLOG_KANBAN.md` (+ `.docx`) | Como montar o board Kanban (GitHub Projects) |

### Artefatos de código já criados

| Categoria | Arquivos |
|---|---|
| Esteira CI (ativa) | `.github/workflows/ci.yml` — lint, testes unitários/integração (Postgres real via `services:`), scan de segurança |
| Esteira Docker | `.github/workflows/docker-build.yml` — build + scan Trivy **automáticos** em push/PR na `main`; publish (GHCR) e deploy em produção **só manuais** (`workflow_dispatch`, deploy exige aprovação humana no Environment `production`) |
| Containers (**ativos e validados**) | `Dockerfile`, `Dockerfile.python`, `docker-compose.yml`, `.dockerignore` — `docker compose up --build -d` |
| Qualidade de código | `.eslintrc.json`, `.flake8`, `requirements-dev.txt`, `tests/test_fornecedores_api.py`, `tests/conftest.py` |
| Colaboração em equipe | `CODEOWNERS`, `.github/pull_request_template.md`, `.github/ISSUE_TEMPLATE/tarefa.yml`, `.github/ISSUE_TEMPLATE/bug.yml`, `.github/ISSUE_TEMPLATE/config.yml` |
| Claude Code | Skill `.claude/skills/cicd-pipeline/`, agente `.claude/agents/devops-engineer.md`, hook `.claude/hooks/pipeline-guardrail.js` (registrado em `.claude/settings.json`) |
| Visual | Artifact publicado (fora do repositório) com o fluxo completo backlog→produção — link só existe na conversa onde foi gerado; se precisar de novo, peça para recriar |

### Validado nesta sessão (rodou de verdade, sem erro)

- `npm run lint` → 0 erros (9 avisos em arquivos antigos, sem urgência)
- `npm run test:unit`, `pytest tests/ -v` (6/6), `bandit -r src/ -q`, `flake8` → todos passando
- YAML dos dois workflows validado (`yaml.safe_load`)
- O hook `pipeline-guardrail.js` testado e bloqueia corretamente reativação automática do deploy Docker
- O exercício de conflito de merge (`EXERCICIO_MULTIPLOS_DEVS.md`) foi **executado de verdade** em uma cópia isolada do repositório para garantir que os comandos documentados funcionam exatamente como descrito

### Sessão 2026-09-24 (máquina Linux nova, com Docker) — Docker ativado

- **Código tornado configurável por variável de ambiente** (padrões = comportamento antigo): `DB_HOST`/`DB_PORT` em `src/db.js` e `src/fornecedores_api.py`; `FORNECEDORES_HOST`/`FORNECEDORES_PORT` em `src/routes/fornecedores.js`; `FLASK_HOST` no Flask. Sem isso o compose não funcionava (containers apontavam para `localhost`).
- **`docker-compose.yml`**: passa essas variáveis; Postgres e API Python publicados só em `127.0.0.1` (API Python não tem auth); `POSTGRES_DB=laboratorio`.
- **Imagens limpas no Trivy** (`CRITICAL,HIGH`, `ignore-unfixed`): npm removido da imagem final do Node; `pip/setuptools/wheel` atualizados na imagem Python.
- **`docker-build.yml`**: build+scan automáticos em push/PR; publish/deploy travados em `workflow_dispatch`. Hook `pipeline-guardrail.js` reescrito para essa nova regra (e agora avalia o arquivo final também em edições parciais).
- Validado de verdade: compose sobe os 3 serviços; login, `/clientes`, criar/listar/remover fornecedor via proxy Node→Python; `npm run lint` (0 erros), `test:unit`, `test:integration` (contra o Postgres do compose), flake8, pytest 6/6, bandit — Python rodado num container `python:3.10-slim` descartável (o Python do sistema não tem `venv`/pip).
- `node_modules` reinstalado com `npm ci` (a cópia vinda do Windows tinha perdido a permissão de execução dos binários em `.bin/`). `.git/index.lock` vazio removido.
- **Pendente de doc:** `docs/ROTEIRO_CICD_CLAUDE_CODE.md` (Passo 7), `docs/SETUP_NOVA_MAQUINA.md` e os `.docx` ainda descrevem o Docker como inativo.

---

## 3. O que NÃO está pronto ainda (próximos passos, em ordem)

Isto é o que falta para "levar o laboratório para valer" (itens riscados já foram feitos):

1. ~~Resolver o arquivo `.git/index.lock`~~ — removido em 2026-09-24.
2. ~~Decidir o que entra no primeiro commit~~ — feito em 2026-09-24 (commit `feat: esteira CI/CD, colaboração em equipe e Docker ativo`). Materiais de curso, logs dos hooks e o PDF de conferência ficaram no `.gitignore` (continuam na pasta local).
3. ~~Renomear a branch para `main`~~ (feito) e **criar o repositório remoto no GitHub** — `docs/ROTEIRO_CICD_CLAUDE_CODE.md`, Passo 1, tem os comandos exatos.
4. **Configurar no GitHub** (depois do primeiro push):
   - Branch protection / rulesets na `main` (Passo 2 do roteiro).
   - "Require review from Code Owners" (ativa o `CODEOWNERS` já criado).
   - Dependabot + CodeQL (Passo 6 do roteiro).
   - Environment `production` com "Required reviewers" (necessário para o job `deploy-production` do `docker-build.yml` funcionar).
5. **Criar o board Kanban** (GitHub Projects) seguindo `docs/BACKLOG_KANBAN.md`.
6. **Rodar o exercício de múltiplos devs de verdade** (`docs/EXERCICIO_MULTIPLOS_DEVS.md`, seção "Como reproduzir") — o que foi feito nesta sessão foi uma simulação de validação; fazer você mesmo é o objetivo de aprendizado.
7. ~~Testar `docker compose up --build`~~ — feito em 2026-09-24. Falta ver o `docker-build.yml` rodar no GitHub (depende do item 3).

---

## 4. Como continuar em outra máquina

Ver `docs/SETUP_NOVA_MAQUINA.md` para o passo a passo completo de portabilidade (o que instalar, como validar que está tudo igual, o que reconfigurar).

---

## 5. Problemas conhecidos (não são bugs do projeto — são do ambiente)

| Problema | Causa provável | O que fazer |
|---|---|---|
| `.git/index.lock` existe e não pôde ser removido durante esta sessão | Sincronização do OneDrive prendendo o arquivo (o projeto vive dentro de uma pasta OneDrive) | Feche o OneDrive temporariamente ou apague o arquivo manualmente pelo Explorer/PowerShell (`Remove-Item .git\index.lock`) antes do próximo `git add`/`commit`. Se o erro voltar a acontecer com frequência, considere mover o repositório para fora da pasta sincronizada pelo OneDrive, ou excluir a pasta `.git` da sincronização (OneDrive → configurações → ignorar pasta). |
| `docs/DEVOPS_GUIA.pdf` e `docs/.~lock.DEVOPS_GUIA.pdf#` | Gerados ao converter o `.docx` para PDF só para conferência visual; o LibreOffice/OneDrive travou o arquivo antes de eu conseguir apagá-lo | Apague os dois manualmente quando puder; não afetam o funcionamento de nada. |
| Testes `teste_servidor.js` não estão na esteira de CI | Exigem o servidor Node rodando de verdade na porta 3000, o que complica automação simples em CI | Ficou de fora por decisão consciente (ver `docs/ROTEIRO_CICD_CLAUDE_CODE.md`, Passo 4) — rode manualmente quando precisar: `node src/server.js` em um terminal, `node src/teste_servidor.js` em outro. |

---

## 6. Para a próxima sessão do Claude Code

Se você é uma nova sessão retomando este projeto: a skill `context-recovery` (`.claude/skills/context-recovery/SKILL.md`) já foi atualizada para ler este arquivo primeiro. Depois de ler este arquivo, confirme com o usuário qual dos itens da seção 3 ele quer atacar agora, antes de propor qualquer implementação nova — não presuma que ele quer continuar exatamente de onde a lista para, porque a ordem ali é uma sugestão, não uma obrigação.
