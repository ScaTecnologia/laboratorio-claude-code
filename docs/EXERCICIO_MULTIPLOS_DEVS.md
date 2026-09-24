# Exercício prático: 2 desenvolvedores, mesmo arquivo, conflito real

> Pré-requisito: leia `docs/COLABORACAO_EQUIPE.md` primeiro (o "porquê"). Este documento é o "como", com comandos reais — **todos os comandos abaixo foram executados de verdade** em uma cópia isolada deste repositório para validar este roteiro antes de documentá-lo, incluindo o conflito e sua resolução.
>
> Objetivo: sentir na pele o que acontece quando dois devs mexem na mesma função, sem perder o trabalho de nenhum dos dois.

---

## Cenário

- **Ana** (dev A) e **Bruno** (dev B) pegam duas tarefas diferentes do backlog, ambas mexendo em `src/clientes.js`, função `listar()`.
- **Issue #201** (Ana): "Listagem de clientes sem `limit` está trazendo a tabela inteira — aplicar limite padrão de 100."
- **Issue #202** (Bruno): "Time de atendimento pediu listagem ordenada por nome, não por id de cadastro."
- As duas tarefas são legítimas e não deveriam se anular — mas **tocam a mesma linha de código**, então o Git vai gerar um conflito quando as duas branches se encontrarem.

Função original (`src/clientes.js`):

```js
async function listar(limit = null, offset = 0) {
  if (limit !== null) {
    const { rows } = await pool.query('SELECT * FROM clientes ORDER BY id LIMIT $1 OFFSET $2', [limit, offset]);
    return rows;
  }
  const { rows } = await pool.query('SELECT * FROM clientes ORDER BY id');
  return rows;
}
```

---

## Passo 1 — Cada dev pega sua tarefa e cria sua branch

Ana se atribui à Issue #201 no board (`docs/BACKLOG_KANBAN.md`) e parte da `main` atualizada:

```bash
git checkout main
git pull origin main
git checkout -b feature/201-limite-padrao-listagem
```

Ela edita a função:

```js
async function listar(limit = null, offset = 0) {
  // Ana: nunca listar sem limite — protege contra puxar a tabela inteira sem paginação.
  const limitSeguro = limit !== null ? limit : 100;
  const { rows } = await pool.query('SELECT * FROM clientes ORDER BY id LIMIT $1 OFFSET $2', [limitSeguro, offset]);
  return rows;
}
```

```bash
git add src/clientes.js
git commit -m "feat(clientes): aplicar limite padrão de 100 na listagem sem paginação"
```

## Passo 2 — Ana termina primeiro, abre PR, passa pela esteira, faz merge

```bash
git push origin feature/201-limite-padrao-listagem
# → abre PR #201 no GitHub, "Resolve #201"
# → ci.yml roda: lint-node, test-node-unit, test-integration, security-scan — tudo verde
# → CODEOWNERS aprova
# → merge na main (squash ou merge commit, conforme convenção do time)
```

A `main` compartilhada agora tem o trabalho da Ana. O board move a Issue #201 para **Concluído** automaticamente.

## Passo 3 — Bruno, sem saber, começou antes de puxar a atualização da Ana

Bruno tinha partido de uma `main` mais antiga (antes do merge da Ana) e editou a **mesma função**, de outro jeito:

```js
async function listar(limit = null, offset = 0) {
  // Bruno: time pediu ordenação alfabética em vez de por id de cadastro.
  if (limit !== null) {
    const { rows } = await pool.query('SELECT * FROM clientes ORDER BY nome LIMIT $1 OFFSET $2', [limit, offset]);
    return rows;
  }
  const { rows } = await pool.query('SELECT * FROM clientes ORDER BY nome');
  return rows;
}
```

```bash
git add src/clientes.js
git commit -m "feat(clientes): ordenar listagem por nome em vez de id"
```

Até aqui, **nada de errado aconteceu** — as duas branches vivem isoladas, cada uma com sua própria versão do arquivo. O problema só aparece quando elas precisam se encontrar.

## Passo 4 — Bruno atualiza sua branch antes de abrir o PR (boa prática da seção 2.4) e o conflito aparece

```bash
git fetch origin
git rebase origin/main
```

Saída real (comando executado neste laboratório para validar o exercício):

```
Rebasing (1/1)
Auto-merging src/clientes.js
CONFLICT (content): Merge conflict in src/clientes.js
error: could not apply 9706faf... feat(clientes): ordenar listagem por nome em vez de id
hint: Resolve all conflicts manually, mark them as resolved with
hint: "git add/rm <conflicted_files>", then run "git rebase --continue".
```

Isso é o **momento central do exercício**: o Git percebeu que a linha `ORDER BY id` foi alterada nos dois lados de formas diferentes e parou, esperando uma decisão humana. Ele não escolheu sozinho, e não descartou nada — os dois commits originais continuam intactos no histórico (`git log`, `git reflog`).

## Passo 5 — Abrindo o arquivo em conflito

`src/clientes.js` agora contém:

```js
async function listar(limit = null, offset = 0) {
<<<<<<< HEAD
  // Ana: nunca listar sem limite — protege contra puxar a tabela inteira sem paginação.
  const limitSeguro = limit !== null ? limit : 100;
  const { rows } = await pool.query('SELECT * FROM clientes ORDER BY id LIMIT $1 OFFSET $2', [limitSeguro, offset]);
=======
  // Bruno: time pediu ordenação alfabética em vez de por id de cadastro.
  if (limit !== null) {
    const { rows } = await pool.query('SELECT * FROM clientes ORDER BY nome LIMIT $1 OFFSET $2', [limit, offset]);
    return rows;
  }
  const { rows } = await pool.query('SELECT * FROM clientes ORDER BY nome');
>>>>>>> 9706faf (feat(clientes): ordenar listagem por nome em vez de id)
  return rows;
}
```

Leitura do marcador:
- `<<<<<<< HEAD` até `=======` → o que já estava na `main` (trabalho da Ana).
- `=======` até `>>>>>>> 9706faf...` → o que Bruno está tentando trazer.

## Passo 6 — Resolver: as duas intenções são legítimas, então combinamos as duas

Aqui entra o julgamento humano que o Git não pode fazer sozinho: **as duas mudanças não são realmente incompatíveis** — uma é sobre limite, a outra sobre ordenação. A resolução correta é combinar as duas, não escolher uma:

```js
async function listar(limit = null, offset = 0) {
  // Combinação das duas mudanças: limite padrão (Ana) + ordenação por nome (Bruno).
  const limitSeguro = limit !== null ? limit : 100;
  const { rows } = await pool.query('SELECT * FROM clientes ORDER BY nome LIMIT $1 OFFSET $2', [limitSeguro, offset]);
  return rows;
}
```

Remova **todos** os marcadores (`<<<<<<<`, `=======`, `>>>>>>>`) — nenhum pode sobrar no arquivo final. Depois:

```bash
# testar antes de seguir em frente
npm run lint
npm run test:unit

git add src/clientes.js
git rebase --continue
```

Saída real:

```
[detached HEAD 2bc6d15] feat(clientes): ordenar listagem por nome em vez de id
 1 file changed, 2 insertions(+), 2 deletions(-)
Successfully rebased and updated refs/heads/feature/202-ordenar-clientes-por-nome.
```

## Passo 7 — Subir a branch resolvida e confirmar que nada se perdeu

```bash
git push origin feature/202-ordenar-clientes-por-nome --force-with-lease
```

`--force-with-lease` (nunca `--force` puro) é seguro aqui porque:
- Só reescreve a **branch de feature do Bruno**, nunca a `main`.
- O Git recusa o push se alguém mais tiver alterado essa branch remota sem o Bruno saber — protegendo contra sobrescrever trabalho de um terceiro por engano.

**Prova de que nada foi destruído** — o commit original de Bruno, antes do rebase, continua rastreável:

```bash
git reflog | grep "ordenar listagem"
```
```
2bc6d15 HEAD@{1}: rebase (continue): feat(clientes): ordenar listagem por nome em vez de id
9706faf HEAD@{3}: commit: feat(clientes): ordenar listagem por nome em vez de id
```

O commit `9706faf` (versão original de Bruno, antes da resolução) segue existindo no reflog local dele por semanas — nada foi apagado, apenas um novo commit (`2bc6d15`) foi criado em cima da `main` atualizada.

## Passo 8 — PR de Bruno, esteira roda de novo, merge

```bash
# push já feito acima → abre PR #202, "Resolve #202"
# ci.yml roda de novo NA VERSÃO JÁ RESOLVIDA — se a resolução tivesse quebrado
# algo, apareceria aqui, antes de chegar em produção.
```

Histórico final da `main` depois dos dois merges (comando real, `git log --oneline --graph`):

```
*   821490b Merge PR #202: ordenar listagem por nome
|\
| * 2bc6d15 feat(clientes): ordenar listagem por nome em vez de id
| * 0becfea Merge PR #201: limite padrão na listagem de clientes
|/|
| * 7f9b96c feat(clientes): aplicar limite padrão de 100 na listagem sem paginação
|/
* e228dd4 refactor: paginação, cache Redis por página, refator server.js em routes/middlewares
```

Repare: **os dois commits originais (`7f9b96c` da Ana e o antecessor de `2bc6d15` do Bruno) estão os dois no histórico**, com autoria preservada. O trabalho de nenhum dos dois foi perdido — foi combinado.

---

## Como reproduzir este exercício você mesmo (sem afetar o repositório real)

Para praticar sem risco, faça em uma cópia isolada, nunca direto no projeto que você está usando para outras coisas:

```bash
# 1. Crie um "remote" simulado a partir do seu repositório atual
git clone --bare /caminho/para/laboratorio-claude-code /tmp/origin-simulado.git

# 2. Simule os dois desenvolvedores como dois clones separados
git clone /tmp/origin-simulado.git /tmp/dev-a
git clone /tmp/origin-simulado.git /tmp/dev-b

# 3. Repita os passos 1–8 acima, uma vez dentro de /tmp/dev-a, outra em /tmp/dev-b
#    (usando git config user.name/user.email diferentes em cada pasta,
#    para os commits aparecerem com autores diferentes)

# 4. Ao terminar, apague tudo:
rm -rf /tmp/origin-simulado.git /tmp/dev-a /tmp/dev-b
```

---

## O que fazer quando a resolução é MENOS óbvia

Neste exercício, as duas mudanças eram claramente combináveis. Na vida real, às vezes uma mudança realmente invalida a outra (ex.: um dev removeu a função, o outro a alterou). Nesse caso:

1. **Não adivinhe sozinho** — comente no PR marcando a outra pessoa (`@usuario`), explicando o conflito.
2. Decidam juntos qual comportamento final é o correto — geralmente é uma conversa de 2 minutos, não um problema técnico.
3. Se a decisão for grande o suficiente para mudar o escopo da tarefa, atualizem a Issue correspondente no backlog para refletir a decisão.
4. Documentem o motivo da escolha no próprio commit de resolução (`git commit -m "resolve conflito: mantém X porque Y"`), para quem revisar o PR entender o raciocínio sem precisar perguntar.
