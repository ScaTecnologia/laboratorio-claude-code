# Trabalho em equipe na esteira de CI/CD — vários devs, um repositório só

> Continuação de `docs/DEVOPS_GUIA.md` e `docs/ROTEIRO_CICD_CLAUDE_CODE.md`. Enquanto aqueles documentos tratam de "como construir a esteira", este trata de **"como várias pessoas usam a mesma esteira ao mesmo tempo sem destruir o trabalho umas das outras"**.
>
> Exercício prático correspondente: `docs/EXERCICIO_MULTIPLOS_DEVS.md` (simula 2 devs, gera um conflito de verdade e mostra como resolver).

---

## 1. O problema, em uma frase

Vários desenvolvedores editam o **mesmo repositório**, às vezes o **mesmo arquivo**, ao mesmo tempo. Sem regras, o trabalho de um sobrescreve o do outro. DevOps resolve isso com 3 camadas independentes, que se reforçam:

1. **Isolamento**: cada tarefa acontece em uma branch separada — ninguém trabalha direto na `main`.
2. **Governança**: ninguém entra na `main` sem passar por Pull Request + revisão + esteira verde.
3. **Reconciliação**: quando duas pessoas *de fato* mexeram na mesma linha, o Git força uma decisão humana explícita (o "conflito de merge") — ele nunca decide sozinho e nunca apaga silenciosamente o trabalho de alguém.

---

## 2. Isolamento — como cada dev pega uma tarefa sem atropelar o outro

### 2.1 O backlog é a fonte única de tarefas

Toda tarefa nasce como um **Issue** no GitHub (ver `docs/BACKLOG_KANBAN.md` para o board). Isso evita duas pessoas decidirem "por fora" que vão mexer na mesma coisa — o board deixa visível quem está fazendo o quê.

Fluxo de uma tarefa:

```
[ To Do ]  →  [ Em Progresso ]  →  [ Em Revisão (PR aberto) ]  →  [ Concluído ]
   ↑ backlog        ↑ dev "pegou"          ↑ CI + review              ↑ merge feito
```

### 2.2 Cada tarefa vira uma branch curta e isolada

Quando um desenvolvedor pega uma issue (se auto-atribui), ele cria uma branch **a partir da `main` atualizada**, nomeada de forma rastreável até a tarefa:

```bash
git checkout main
git pull origin main                     # main atualizada — ponto de partida limpo
git checkout -b feature/123-corrigir-validacao-cnpj   # 123 = número da issue
```

Convenção de nome adotada neste projeto: `<tipo>/<numero-da-issue>-<descricao-curta>`, onde `<tipo>` é `feature`, `fix`, `chore` ou `hotfix`.

**Por que isso evita atropelo:** cada branch é uma cópia independente do código. O que o dev A faz na branch dele **não aparece** na branch do dev B, nem na `main`, até que ele explicitamente abra e tenha aprovado um Pull Request. Dois devs podem trabalhar em arquivos completamente diferentes, ou até no mesmo arquivo, sem qualquer interferência até o momento do merge.

### 2.3 Branches curtas > branches longas

Quanto mais tempo uma branch fica aberta sem sincronizar com a `main`, maior a chance de ela divergir tanto que o merge vira um pesadelo. Prática recomendada (trunk-based development, adotada por times de alta performance segundo a pesquisa DORA): branches que vivem **horas ou 1–2 dias**, não semanas. Tarefas grandes demais para isso devem ser quebradas em tarefas menores no backlog.

### 2.4 Trazer a `main` para dentro da sua branch com frequência

Enquanto trabalha, o dev deve puxar as mudanças que outras pessoas já fizeram merge na `main`, para descobrir cedo se vai haver conflito — não só no fim:

```bash
git fetch origin
git rebase origin/main     # reaplica seus commits em cima da main atualizada
# (alternativa mais simples para quem está começando: git merge origin/main)
```

Fazer isso a cada poucas horas, em vez de só no fim, transforma "um conflito gigante no fim" em "vários conflitos pequenos e administráveis ao longo do caminho" (ou nenhum).

---

## 3. Governança — ninguém entra na `main` sem esteira e revisão

### 3.1 Branch protection / Repository Rulesets

Configurado em `Settings → Branches` (ou `Settings → Rules → Rulesets`, a evolução mais recente do GitHub) para a branch `main`:

| Regra | Por quê |
|---|---|
| Exigir Pull Request antes de merge | Ninguém edita a `main` diretamente |
| Exigir 1+ aprovação (2 para arquivos sensíveis, via CODEOWNERS) | Segundo par de olhos antes de produção |
| Exigir que os checks do `ci.yml` passem (lint, testes, segurança) | A esteira é o "juiz" objetivo — não é opinião de ninguém |
| Exigir que a branch esteja atualizada com a `main` antes do merge | Garante que o PR foi testado *com* as mudanças mais recentes dos outros, não só com uma foto antiga |
| Bloquear force-push e deleção da `main` | Ninguém reescreve o histórico compartilhado |

### 3.2 CODEOWNERS — revisão obrigatória por dono da área

O arquivo `CODEOWNERS` (raiz do projeto, criado neste laboratório) declara quem **precisa** revisar mudanças em cada parte do código:

```
# Qualquer alteração em rotas/autenticação precisa do dono de segurança
/src/middlewares/  @ScaTecnologia
/src/routes/auth.js @ScaTecnologia

# Pipeline e infraestrutura
/.github/  @ScaTecnologia
/Dockerfile* @ScaTecnologia
/docker-compose.yml @ScaTecnologia
```

Isso evita que uma mudança arriscada (ex.: autenticação) seja aprovada por alguém sem contexto suficiente — o GitHub **exige** a revisão da pessoa/time listado antes de permitir o merge.

### 3.3 A esteira roda para cada PR, isolada

Cada Pull Request dispara o `ci.yml` (lint + testes + segurança) **na branch daquele PR**, isoladamente. Isso significa: o trabalho do dev A é validado sozinho, o do dev B também, e só depois de cada um passar (e ser aprovado) é que entram na `main`, um de cada vez. A esteira nunca mistura o código de duas PRs diferentes.

### 3.4 Pull Request template — dar contexto para quem revisa

`.github/pull_request_template.md` (criado neste laboratório) padroniza o que todo PR deve informar: o que mudou, qual issue resolve, como testar, se afeta segurança. Isso acelera a revisão e reduz aprovações "no escuro".

---

## 4. Reconciliação — o que é, na prática, um conflito de merge

### 4.1 Quando ele acontece

Um conflito de merge acontece quando **duas branches alteram a(s) mesma(s) linha(s) do mesmo arquivo** de formas diferentes, e o Git não consegue decidir sozinho qual versão manter. É importante entender o que o Git faz nesse momento:

- Ele **não escolhe** uma versão e descarta a outra.
- Ele **não apaga** o trabalho de ninguém.
- Ele **para** o merge/rebase e marca o(s) arquivo(s) em conflito, esperando uma decisão humana.

Se as duas pessoas alteraram **arquivos diferentes**, ou **partes diferentes do mesmo arquivo** (linhas distantes), o Git resolve sozinho — a maioria das mudanças do dia a dia se encaixa nesse caso e nunca vira conflito visível.

### 4.2 Como o conflito aparece

```bash
git rebase origin/main
# ...
# CONFLICT (content): Merge conflict in src/clientes.js
```

O arquivo em conflito passa a conter marcadores especiais:

```
<<<<<<< HEAD
    return `${cliente.nome} — ${cliente.cidade}`;
=======
    return `${cliente.nome} (${cliente.email})`;
>>>>>>> feature/123-corrigir-validacao-cnpj
```

- Tudo entre `<<<<<<< HEAD` e `=======` é a versão que já estava na branch de destino.
- Tudo entre `=======` e `>>>>>>> <branch>` é a versão que está chegando.

### 4.3 Como resolver, passo a passo

1. Abrir o arquivo e decidir o resultado correto — pode ser uma das duas versões, ou uma combinação das duas (o mais comum). Ver o exercício prático (`docs/EXERCICIO_MULTIPLOS_DEVS.md`) para um caso real resolvido linha a linha.
2. Remover os marcadores (`<<<<<<<`, `=======`, `>>>>>>>`) — eles nunca devem sobrar no código final.
3. Testar localmente que o resultado faz sentido (`npm run test:unit`, e o `lint`).
4. Marcar como resolvido e continuar:
   ```bash
   git add src/clientes.js
   git rebase --continue      # ou: git commit  (se estiver em um merge, não rebase)
   ```
5. Subir a branch e deixar a esteira confirmar de novo:
   ```bash
   git push --force-with-lease   # necessário após rebase, pois reescreve os commits da SUA branch
   ```

   > `--force-with-lease` (não `--force` puro) é seguro aqui porque só reescreve a **sua própria branch de feature**, nunca a `main` — e ele recusa o push se alguém mais tiver alterado essa branch remota sem você saber, evitando sobrescrever trabalho alheio por engano.

### 4.4 Por que isso não é "perder o trabalho de alguém"

O medo comum de quem está aprendendo é: "e se eu escolher errado e apagar o que o outro fez?" Na prática:

- O commit original de cada pessoa **continua existindo no histórico do Git** (`git log`, `git reflog`) mesmo depois de um conflito resolvido "errado" — nada é destruído de verdade, dá para recuperar.
- A resolução do conflito é **um novo commit revisável**: ele aparece no PR como qualquer outra mudança, e o CODEOWNERS/revisor pode notar se algo foi perdido por engano.
- A esteira (`ci.yml`) roda de novo depois da resolução — se a resolução quebrou um teste, isso aparece **antes** de chegar em produção, não depois.

### 4.5 Práticas que reduzem a frequência de conflitos

| Prática | Efeito |
|---|---|
| Branches curtas (seção 2.3) | Menos tempo para divergir |
| Tarefas bem fatiadas no backlog (arquivos/módulos diferentes por tarefa) | Menos gente mexendo no mesmo arquivo ao mesmo tempo |
| `git pull`/`rebase` frequente da `main` | Conflitos pequenos e cedo, não um grande no fim |
| Funções pequenas e coesas (menos "arquivos gigantes que todo mundo precisa tocar") | Menos colisão de linha |
| Comunicação simples ("vou mexer em `clientes.js` hoje", no canal da equipe) | Complementa o Git, não substitui — combina bem com o board Kanban visível para todos |

---

## 5. O caminho completo: do backlog à produção

```
┌─────────────┐   ┌──────────────┐   ┌────────────┐   ┌───────────────┐   ┌─────────┐   ┌────────────┐
│  BACKLOG    │──▶│ DEV ESCOLHE  │──▶│  BRANCH    │──▶│  PULL REQUEST │──▶│  MERGE  │──▶│  DEPLOY    │
│ (Issue no   │   │ a tarefa     │   │  isolada   │   │  + CI (lint/  │   │ na main │   │  manual    │
│  board)     │   │ (auto-assign)│   │  (feature/)│   │  test/segur.) │   │         │   │ (aprovação)│
│             │   │              │   │            │   │  + review     │   │         │   │            │
│             │   │              │   │            │   │  (CODEOWNERS) │   │         │   │            │
└─────────────┘   └──────────────┘   └────────────┘   └───────────────┘   └─────────┘   └────────────┘
                                                                                              │
                                                                                              ▼
                                                                                     ┌──────────────────┐
                                                                                     │ Ambiente          │
                                                                                     │ "production"      │
                                                                                     │ (GitHub           │
                                                                                     │  Environment) —   │
                                                                                     │ exige aprovação    │
                                                                                     │ humana antes do    │
                                                                                     │ job rodar          │
                                                                                     └──────────────────┘
```

Cada seta acima tem um artefato concreto neste projeto:

| Etapa | Onde está |
|---|---|
| Backlog | `docs/BACKLOG_KANBAN.md` + `.github/ISSUE_TEMPLATE/` |
| Branch isolada | Convenção da seção 2.2 deste documento |
| Pull Request + CI | `.github/pull_request_template.md` + `.github/workflows/ci.yml` |
| Revisão obrigatória | `CODEOWNERS` + branch protection (seção 3.1) |
| Deploy com aprovação | `.github/workflows/docker-build.yml` (jobs `deploy-*`, ambiente `production`) |

Exercício prático completo (2 devs simulados, conflito real, resolução, PR e deploy): `docs/EXERCICIO_MULTIPLOS_DEVS.md`.

---

## Referências

- [Trunk-Based Development vs Git Flow — 2026 CI/CD Guide](https://khimananda.com/blog/trunk-based-development-vs-git-flow)
- [Git Branching Strategies — Codelit.io](https://codelit.io/blog/git-branching-strategies)
- [GitFlow vs GitHub Flow vs Trunk-Based Development](https://codewithmukesh.com/blog/git-workflows-gitflow-vs-github-flow-vs-trunk-based-development/)
- [GitHub Docs — About CODEOWNERS](https://docs.github.com/articles/about-code-owners)
- [GitHub Docs — Repository rules and rulesets](https://docs.github.com/repositories/configuring-branches-and-merges-in-your-repository)
- [GitHub Docs — Using environments for deployment](https://docs.github.com/actions/deployment/targeting-different-environments/using-environments-for-deployment)
