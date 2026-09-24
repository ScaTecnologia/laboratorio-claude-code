# Guia de DevOps e CI/CD — Fundamentos e Boas Práticas de Mercado

> Documento de estudo. Base para o roteiro prático em `docs/ROTEIRO_CICD_CLAUDE_CODE.md`, que implementa estes conceitos no projeto `laboratorio-claude-code`.

---

## 1. O que é DevOps

DevOps é a união de **cultura, práticas e ferramentas** que aumenta a capacidade de uma organização entregar software com qualidade, em ciclos curtos e de forma confiável, eliminando a separação tradicional entre times de Desenvolvimento (Dev) e Operações (Ops).

Não é um cargo, uma ferramenta ou um pipeline — é um modelo operacional. As referências mais citadas do mercado (Google Cloud DORA, AWS, Atlassian, CNCF) convergem para o mesmo núcleo:

- **Cultura de responsabilidade compartilhada**: quem escreve o código também participa da operação e do suporte em produção.
- **Automação de ponta a ponta**: build, teste, empacotamento, deploy e infraestrutura são código, não passos manuais.
- **Entrega contínua e incremental**: mudanças pequenas e frequentes reduzem risco, ao contrário de grandes releases trimestrais.
- **Medição objetiva**: decisões baseadas em métricas (DORA), não em opinião.
- **Melhoria contínua**: post-mortems sem culpa, retrospectivas, débito técnico tratado como prioridade.

### Modelo CALMS

Framework clássico (Jez Humble / John Willis) para avaliar maturidade DevOps:

| Pilar | Significado | Exemplo prático |
|---|---|---|
| **C**ulture | Colaboração Dev+Ops+Segurança, sem "jogar por cima do muro" | Squads multidisciplinares, on-call compartilhado |
| **A**utomation | Eliminar trabalho manual repetitivo | Pipelines de CI/CD, Infra as Code |
| **L**ean | Fluxo de valor enxuto, lotes pequenos | Feature flags, trunk-based development |
| **M**easurement | Métricas de entrega e operação | DORA metrics, SLOs |
| **S**haring | Conhecimento e ferramentas compartilhados | Runbooks, documentação viva, blameless postmortems |

### As métricas DORA (padrão de mercado para medir maturidade DevOps)

Publicadas anualmente pelo *DORA — DevOps Research and Assessment* (Google Cloud). São 5 métricas, 2 de velocidade e 3 de estabilidade — a disciplina do modelo é evoluir todas juntas, nunca trocar velocidade por estabilidade:

| Métrica | O que mede | Elite performers (referência de mercado) |
|---|---|---|
| **Deployment Frequency** | Com que frequência você coloca código em produção | Várias vezes ao dia |
| **Lead Time for Changes** | Tempo do commit até rodar em produção | Menos de 1 hora |
| **Change Failure Rate** | % de deploys que causam falha em produção | 0–15% |
| **Failed Deployment Recovery Time (MTTR)** | Tempo para recuperar de uma falha em produção | Menos de 1 hora |
| **Rework Rate** *(métrica mais recente, incorporada em 2024+)* | % de mudanças que precisam ser refeitas após o deploy | Quanto menor, melhor |

Fonte: [DORA Metrics — GetDX](https://getdx.com/blog/dora-metrics/), [DORA / Google Cloud](https://dora.dev/).

---

## 2. As etapas de uma esteira DevOps (o "ciclo infinito")

O fluxo de valor de DevOps costuma ser representado em 8 fases contínuas:

```
PLAN → CODE → BUILD → TEST → RELEASE → DEPLOY → OPERATE → MONITOR
  ↑___________________________________________________________|
                     (feedback contínuo)
```

Para cada etapa, o mercado reconhece práticas e ferramentas específicas. A tabela abaixo cita as mais adotadas — não é obrigatório usar todas; a ideia é conhecer as opções e escolher pelo contexto do projeto.

### PLAN — Planejamento

| Prática | Ferramentas comuns no mercado |
|---|---|
| Backlog e rastreio de trabalho | Jira, Azure Boards, Linear, GitHub Projects |
| Definição de arquitetura e ADRs (Architecture Decision Records) | Markdown versionado no repo, Confluence |
| Modelagem de ameaças (threat modeling) | OWASP Threat Dragon |

### CODE — Desenvolvimento

| Prática | Ferramentas comuns |
|---|---|
| Controle de versão distribuído | Git (GitHub, GitLab, Azure Repos, Bitbucket) |
| Padrão de branches | Trunk-Based Development (recomendado para deploy contínuo) ou GitHub Flow; Git Flow para releases versionadas/lentas |
| Convenção de commits | Conventional Commits (`feat:`, `fix:`, `chore:`...) |
| Revisão de código | Pull/Merge Requests + revisão obrigatória (2 aprovações mínimo em produção) |
| Assistentes de codificação com IA | Claude Code, GitHub Copilot |
| Pre-commit hooks | Husky (Node), pre-commit (Python) |

### BUILD — Construção

| Prática | Ferramentas comuns |
|---|---|
| Build reprodutível | npm/yarn/pnpm (Node), pip/poetry (Python), Maven/Gradle (Java) |
| Empacotamento em contêiner | Docker, Buildpacks, Podman |
| Gestão de dependências e SBOM | Dependabot, Renovate, Syft (SBOM) |
| Versionamento de artefatos | SemVer, tags de imagem por SHA de commit |
| Registro de artefatos | Docker Hub, GitHub Container Registry (GHCR), Azure Container Registry, Artifactory |

### TEST — Qualidade

| Camada | Ferramentas comuns |
|---|---|
| Lint / análise estática | ESLint (JS/TS), Flake8/Ruff (Python), SonarQube/SonarCloud |
| Testes unitários | Jest/Vitest/node:test (Node), Pytest (Python), JUnit (Java) |
| Testes de integração | Testcontainers, serviços via `docker-compose` ou `services:` do CI |
| Testes end-to-end (E2E) | Playwright, Cypress |
| Testes de contrato de API | Pact |
| Testes de performance/carga | k6, JMeter, Gatling |
| Cobertura de código | Istanbul/nyc, coverage.py, Codecov |

### SECURITY (DevSecOps — atravessa todas as etapas)

| Prática | Ferramentas comuns |
|---|---|
| SAST (análise estática de segurança) | CodeQL (GitHub nativo), Semgrep, Bandit (Python) |
| Dependências vulneráveis (SCA) | `npm audit`, `pip-audit`, Dependabot, Snyk, Trivy |
| Segredos vazados no código | Gitleaks, TruffleHog |
| Scan de imagem de contêiner | Trivy, Grype |
| DAST (teste dinâmico em app rodando) | OWASP ZAP |
| Gestão de segredos em runtime | HashiCorp Vault, GitHub Actions Secrets, Azure Key Vault |

### RELEASE — Liberação

| Prática | Ferramentas comuns |
|---|---|
| Orquestração de pipeline | GitHub Actions, GitLab CI, Azure Pipelines, Jenkins, CircleCI |
| Gates de aprovação (produção) | Environments protegidos (GitHub Environments, Azure Approvals) |
| Changelog automático | semantic-release, Release Please |
| Feature flags (liberar sem deploy) | LaunchDarkly, Unleash, flags próprios |

### DEPLOY — Implantação

| Estratégia | Quando usar |
|---|---|
| Rolling update | Padrão, baixo risco, indisponibilidade mínima |
| Blue-Green | Troca instantânea entre dois ambientes idênticos; rollback imediato |
| Canary | Libera para % pequeno de usuários antes do rollout total |
| Feature flags | Deploy do código "desligado"; ativa via configuração |

| Ferramentas de infraestrutura/deploy |
|---|
| Infra as Code: Terraform, Pulumi, Bicep (Azure), CloudFormation (AWS) |
| Orquestração de contêineres: Kubernetes, Docker Swarm, ECS |
| Gestão de configuração: Ansible, Chef, Puppet |
| GitOps: ArgoCD, Flux |
| PaaS simplificado: Azure App Service, Heroku, Render, Fly.io |

### OPERATE & MONITOR — Operação e Observabilidade

| Prática | Ferramentas comuns |
|---|---|
| Métricas | Prometheus + Grafana, Azure Monitor, Datadog |
| Logs centralizados | ELK/EFK Stack, Loki, Azure Log Analytics |
| Tracing distribuído | OpenTelemetry, Jaeger |
| Alertas e on-call | PagerDuty, Opsgenie, Grafana OnCall |
| SLOs/SLIs e error budget | Definição de disponibilidade-alvo por serviço |

---

## 3. Plataformas de CI/CD — comparativo

| Critério | GitHub Actions | Azure DevOps (Pipelines) | GitLab CI |
|---|---|---|---|
| Hospedagem do código | GitHub | Azure Repos ou GitHub | GitLab |
| Formato de pipeline | YAML em `.github/workflows/` | YAML (`azure-pipelines.yml`) ou clássico visual | YAML (`.gitlab-ci.yml`) |
| Runners gratuitos (repos públicos) | Generosos | Generosos (Microsoft-hosted) | Generosos no GitLab.com |
| Integração nativa com Claude Code | Muito boa (GitHub é o padrão de mercado, ampla documentação) | Boa, requer configuração de Service Connection | Boa |
| Indicado para | Times já no GitHub, open source, aprendizado | Empresas com stack Microsoft/Azure, compliance corporativo | Times que querem tudo em uma plataforma (repo + CI + registry) |
| Curva de aprendizado | Baixa | Média | Baixa-média |

> Para o laboratório `laboratorio-claude-code`, o roteiro prático (`ROTEIRO_CICD_CLAUDE_CODE.md`) usa **GitHub Actions** por ser gratuito, ter a maior base de exemplos/documentação e integrar-se bem ao fluxo de trabalho do Claude Code (PRs, Issues, Actions). Os conceitos são os mesmos nas outras plataformas — muda a sintaxe do YAML.

---

## 4. Arquitetura de referência para o laboratório

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              DESENVOLVEDOR                               │
│              (com Claude Code auxiliando em cada etapa)                  │
└───────────────────────────────┬────────────────────────────────────────-─┘
                                 │ git push / pull request
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          GITHUB (repositório)                            │
│  Branch protection • PR obrigatório • CODEOWNERS • Secrets              │
└───────────────────────────────┬────────────────────────────────────────-─┘
                                 │ dispara
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     GITHUB ACTIONS — CI (.github/workflows/ci.yml)       │
│                                                                          │
│  [lint-node] [lint-python]        (paralelo — falha rápido)             │
│        │            │                                                  │
│        └─────┬──────┘                                                  │
│               ▼                                                        │
│  [test-node-unit]  (sem dependências externas — inclui mocks in-memory)│
│               │                                                        │
│               ▼                                                        │
│  [test-integration]  — services: postgres:5151                         │
│               │                                                        │
│               ▼                                                        │
│  [security-scan]  — npm audit / pip-audit / bandit / CodeQL            │
│                                                                          │
└───────────────────────────────┬────────────────────────────────────────-─┘
                                 │ tudo verde
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│         GITHUB ACTIONS — docker-build.yml                                │
│  push/PR (automático): [build-node|python] → [scan Trivy]               │
│  workflow_dispatch (manual): + [publish GHCR] + [deploy production]     │
│  ⚠ Deploy só com aprovação humana no Environment "production".          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Onde o Claude Code entra em cada etapa

| Etapa | Como o Claude Code ajuda |
|---|---|
| Plan | Analisar requisitos, propor arquitetura, criar ADRs |
| Code | Escrever código seguindo `CLAUDE.md`, aplicar skills do projeto |
| Test | Gerar testes unitários/integração junto com a função (skill `criar-funcao-com-teste`) |
| Build/CI | Criar e manter os arquivos de workflow (`.github/workflows/*.yml`) |
| Security | Hooks determinísticos (`PreToolUse`) bloqueiam padrões inseguros antes de o arquivo ser salvo |
| Release/Deploy | Gerar e validar Dockerfile, docker-compose e workflow de deploy (build + scan Trivy automáticos; publish/deploy manuais com aprovação) |
| Operate/Monitor | Analisar logs, sugerir alertas, revisar métricas |

Isso é o que o restante da documentação implementa: `docs/ROTEIRO_CICD_CLAUDE_CODE.md` (passo a passo), mais os artefatos em `.claude/` (skill, agente, hook) e `.github/workflows/` (pipelines reais) descritos em `docs/PROMPT_INICIAL_PROJETO.md`.

---

## Referências

- [DORA / Google Cloud — DevOps Research and Assessment](https://dora.dev/)
- [DORA Metrics — guia completo (GetDX)](https://getdx.com/blog/dora-metrics/)
- [CI/CD Pipeline Best Practices 2026 (DEV Community)](https://dev.to/asifthewebguy/cicd-pipeline-best-practices-a-production-ready-guide-for-2026-5fon)
- [CI/CD Pipeline Design 2026 — Engineering Reference](https://www.digitalapplied.com/blog/ci-cd-pipeline-design-2026-engineering-reference)
- [CI/CD Implementation Guide 2026 — Pipelines, DORA, DevSecOps (EITT)](https://eitt.academy/knowledge-base/ci-cd-implementation-practical-guide/)
- [OWASP DevSecOps Guideline](https://owasp.org/www-project-devsecops-guideline/)
- [GitHub Actions — documentação oficial](https://docs.github.com/actions)
