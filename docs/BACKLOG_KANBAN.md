# Backlog e board Kanban (GitHub Projects)

> Interface visual do "onde cada tarefa está" — complementa `docs/COLABORACAO_EQUIPE.md` (o "porquê"/regras) e `.github/ISSUE_TEMPLATE/` (o "formulário" de entrada de tarefas).

---

## 1. Por que um board, e não uma lista solta

Sem um board visível para todo o time, é comum duas pessoas decidirem — cada uma por conta própria — atacar a mesma parte do sistema, ou uma tarefa importante ficar esquecida. O board Kanban resolve isso tornando público e atualizado:

- O que ainda não começou (**To Do**).
- Quem está fazendo o quê agora (**Em Progresso**, com o dev atribuído).
- O que já foi feito mas está esperando revisão humana (**Em Revisão**).
- O que já está na `main`, pronto (**Concluído**).

## 2. Como criar o board (GitHub Projects — gratuito)

1. No repositório no GitHub: aba **Projects → New project → Board**.
2. Renomeie para `LabSystem — Esteira`.
3. Colunas recomendadas (renomear as padrão / criar):

| Coluna | Significa |
|---|---|
| **Backlog** | Ideias e tarefas ainda não priorizadas |
| **To Do** | Priorizado, pronto para alguém pegar |
| **Em Progresso** | Alguém se atribuiu e já criou a branch |
| **Em Revisão** | PR aberto, esperando CI + aprovação |
| **Concluído** | Merge feito na `main` |

4. **Automação nativa** (aba do projeto → Workflows, sem custo extra):
   - Issue criada → entra em **Backlog**.
   - Issue atribuída (assign) a alguém → move para **Em Progresso**.
   - Pull Request vinculado à issue é aberto → move para **Em Revisão**.
   - Pull Request é mergeado → issue vinculada move para **Concluído** e é fechada automaticamente.

5. Vincule Issues criadas a partir de `.github/ISSUE_TEMPLATE/tarefa.yml` ou `bug.yml` ao projeto (`Projects` na lateral da issue).

## 3. Como um item de tarefa "vira" código, na prática

```
1. Alguém cria a Issue (template "Tarefa") com critérios de aceite claros.
   └─ Board: entra em Backlog.

2. Time prioriza → move manualmente para To Do.

3. Um dev se auto-atribui (Assignees → eu).
   └─ Board: move automaticamente para Em Progresso.
   └─ Dev cria a branch: git checkout -b feature/42-nome-da-tarefa

4. Dev commita, dá push, abre PR com "Resolve #42" na descrição
   (o template de PR já lembra disso).
   └─ Board: move automaticamente para Em Revisão.
   └─ ci.yml roda automaticamente.

5. CODEOWNERS aprova, CI está verde → merge.
   └─ Board: issue #42 fecha e move para Concluído, automaticamente.
```

## 4. Regra de ouro para evitar duas pessoas na mesma tarefa

**Nunca comece a codar uma tarefa sem antes se auto-atribuir a ela no GitHub.** Isso é o sinal público, em tempo real, de "estou nisso" — mais confiável que avisar no chat, porque fica registrado e todo o time vê o board a qualquer momento, inclusive quem entrar depois.

Se duas pessoas quiserem a mesma tarefa: quem comentar/se atribuir primeiro leva; a segunda pessoa pega outra tarefa do **To Do** ou combina divisão de escopo direto na issue (comentário), evitando que as duas abram branches para o mesmo objetivo.

## 5. Backlog pequeno o suficiente para caber em uma esteira rápida

Uma tarefa bem escrita no template (`tarefa.yml`) deve ser fatiável o bastante para virar **uma branch curta** (ver `docs/COLABORACAO_EQUIPE.md`, seção 2.3) — normalmente algo entre "algumas horas" e "um dia" de trabalho. Tarefas maiores devem ser quebradas em sub-issues antes de entrar em **To Do**.
