# Prompt inicial para começar um projeto com CI/CD no Claude Code

Use este prompt (adaptando o que estiver em `[colchetes]`) sempre que iniciar um projeto novo em que você já quer nascer com esteira de CI/CD pensada desde o primeiro commit.

---

## Prompt-modelo

```
Vou iniciar um projeto novo: [nome e uma frase descrevendo o objetivo].
Stack: [linguagens/frameworks, ex: Node.js + Express, Python + Flask].
Banco de dados: [ex: PostgreSQL local].
Plataforma de CI/CD alvo: GitHub Actions.
Restrição do ambiente: [ex: máquina corporativa sem permissão para Docker].

Quero que você:
1. Crie a estrutura inicial do projeto seguindo boas práticas da stack escolhida.
2. Crie um CLAUDE.md com stack, comandos, regras do projeto e credenciais de
   desenvolvimento (nunca reais).
3. Configure lint (ESLint/Flake8 conforme a stack) e um teste unitário mínimo
   que sirva de exemplo para os próximos.
4. Crie .github/workflows/ci.yml com jobs separados de lint, teste unitário,
   teste de integração (usando `services:` do próprio GitHub Actions para
   banco de dados — não Docker local) e verificação de segurança
   (npm audit / pip-audit conforme a stack).
5. Se eu pedir Docker/contêineres e a restrição do ambiente não permitir,
   crie os arquivos (Dockerfile, docker-compose.yml, workflow de build)
   mas com o gatilho do workflow em `workflow_dispatch` apenas (manual),
   nunca automático — e me explique como habilitar depois.
6. Crie uma skill em .claude/skills/cicd-pipeline/SKILL.md documentando o
   padrão de pipeline adotado, para que futuras mudanças sigam o mesmo estilo.
7. Crie um hook PreToolUse simples que impeça reativar automaticamente um
   workflow marcado como manual/inativo sem eu confirmar explicitamente.

Antes de criar qualquer arquivo, me mostre o plano e a lista de arquivos que
serão criados/alterados, e só prossiga após minha confirmação.
```

---

## Por que este prompt funciona bem

- **Contexto primeiro, ação depois**: define stack, banco e restrição de ambiente antes de pedir qualquer arquivo — evita retrabalho (o Claude Code não vai sugerir Docker automático numa máquina que não permite).
- **CI antes de CD**: pede lint/teste/CI primeiro; Docker/CD vem depois e de forma explicitamente controlada — replica a ordem natural de maturidade DevOps (não adianta ter deploy automatizado sem testes confiáveis).
- **Pede plano antes de execução**: alinhado à regra "antes de alterar código, explique o plano" já usada no `CLAUDE.md` deste laboratório.
- **Fecha o ciclo com governança**: pede explicitamente uma skill (padroniza o conhecimento) e um hook (garante a regra de negócio de forma determinística, não dependente de "lembrar" da instrução).

---

## Variações do prompt para tarefas pontuais

**Adicionar segurança a um pipeline já existente:**
```
Revise .github/workflows/ci.yml e adicione um job de scan de segurança
(SAST + dependências vulneráveis) apropriado para a stack deste projeto,
sem quebrar os jobs existentes. Explique cada ferramenta escolhida.
```

**Diagnosticar uma esteira quebrada:**
```
O job [nome do job] está falhando no GitHub Actions. Aqui está o log: [colar log].
Explique a causa raiz antes de propor a correção.
```

**Preparar para deploy real (quando sair do ambiente restrito):**
```
Estou agora numa máquina/ambiente que permite Docker e temos um provedor
de nuvem definido: [AWS/Azure/GCP]. Use o agente devops-engineer para
avaliar Dockerfile e docker-compose.yml atuais e propor a estratégia de
deploy (rolling, blue-green ou canary) mais adequada para este projeto,
sem aplicar mudanças ainda.
```

---

## Artefatos deste projeto que implementam este padrão

| Artefato | Caminho |
|---|---|
| Skill de pipeline | `.claude/skills/cicd-pipeline/SKILL.md` |
| Agente DevOps | `.claude/agents/devops-engineer.md` |
| Hook de governança do pipeline | `.claude/hooks/pipeline-guardrail.js` |
| Workflow de CI ativo | `.github/workflows/ci.yml` |
| Workflow Docker (build+scan automáticos; publish/deploy manuais) | `.github/workflows/docker-build.yml` |
| Guia teórico | `docs/DEVOPS_GUIA.md` |
| Roteiro de implementação | `docs/ROTEIRO_CICD_CLAUDE_CODE.md` |
