# Simulando 2 desenvolvedores na mesma máquina (com containers)

> Para quem nunca usou containers. Pré-requisito: Docker funcionando (`docker compose version`). Contexto do fluxo card → branch → PR: `docs/BACKLOG_KANBAN.md`.

---

## 1. A ideia em 30 segundos

**O container não é "do desenvolvedor".** Cada dev tem a **própria cópia do código** (uma pasta com o clone do repositório, na branch dele). O container é só **a forma de rodar o sistema** a partir daquela cópia.

```
Pasta do Dev 1 (branch dele)            Pasta do Dev 2 (branch dele)
└─ docker compose ... up                └─ docker compose ... up
   → postgres + node + fornecedores        → postgres + node + fornecedores
     banco SÓ do Dev 1                       banco SÓ do Dev 2
     http://localhost:3010                   http://localhost:3020
                 \                          /
                  \── git push → PR ───────/
                     GitHub (main, CI, board Kanban)
```

- Os containers são **idênticos** para todos (mesmo Node, Python e Postgres, definidos no `Dockerfile` e no `docker-compose.yml`) — por isso não existe mais "na minha máquina funciona".
- O código dos dois **só se encontra no GitHub**, via Pull Request. Os containers nunca conversam entre si.
- Numa empresa, cada dev faz isso no próprio computador. Aqui você faz os dois papéis, com duas pastas.

## 2. O que já está preparado

| | Dev 1 | Dev 2 | (pasta principal) |
|---|---|---|---|
| Pasta | `~/devs/dev1/laboratorio-claude-code` | `~/devs/dev2/laboratorio-claude-code` | `~/Documentos/laboratorio-claude-code` |
| Autor dos commits | `Dev 1` | `Dev 2` | `alexaugusto2` |
| Sistema (navegador) | http://localhost:3010 | http://localhost:3020 | http://localhost:3000 |
| API Python (só local) | 3011 | 3021 | 3001 |
| Postgres (só local) | 5161 | 5162 | 5151 |
| Nome dos containers | `dev1-...` | `dev2-...` | `laboratorio-claude-code-...` |

As portas e o nome ficam no arquivo `portas.env` de cada pasta (fora do Git). Por isso **todo comando do compose leva `--env-file portas.env`**.

**Login em um banco novo:** `admin@labsystem.com` / `admin123` (o sistema cria esse admin sozinho quando o banco está vazio).

## 3. Comandos do dia a dia

Sempre **entre na pasta do dev primeiro** — é isso que define "quem você é":

```bash
cd ~/devs/dev1/laboratorio-claude-code      # agora você é o Dev 1
```

| Quero... | Comando |
|---|---|
| Subir o sistema com o código atual da pasta | `docker compose --env-file portas.env up --build -d` |
| Ver se está rodando | `docker compose --env-file portas.env ps` |
| Ver os logs do app (Ctrl+C sai) | `docker compose --env-file portas.env logs -f node` |
| Parar (os dados do banco ficam guardados) | `docker compose --env-file portas.env down` |
| Parar e **apagar o banco** deste dev | `docker compose --env-file portas.env down -v` |
| Ver **todos** os containers da máquina | `docker ps` |
| Conferir quem eu sou e em que branch estou | `git config user.name && git branch --show-current` |

**Mudou o código? Rode o `up --build -d` de novo** — o container é reconstruído com a versão nova. Páginas HTML/JS e o servidor Node só mudam no container depois desse comando.

## 4. Roteiro: dois devs, dois cards, ao mesmo tempo

1. **Crie (ou escolha) dois cards** no board — https://github.com/users/ScaTecnologia/projects/2. Ex.: o #27 (quantidade de clientes) para o Dev 1 e outro para o Dev 2.

2. **Dev 1 pega o card e cria a branch** — no GitHub, abra a issue, *Assignees* → você; *Development → Create a branch*. Depois:
   ```bash
   cd ~/devs/dev1/laboratorio-claude-code
   git fetch origin
   git checkout <nome-da-branch-que-o-github-mostrou>
   docker compose --env-file portas.env up --build -d
   ```
   Abra http://localhost:3010, altere o código, rode o `up --build -d` de novo e veja a mudança.

3. **Dev 2 faz o mesmo na pasta dele**:
   ```bash
   cd ~/devs/dev2/laboratorio-claude-code
   git fetch origin
   git checkout <branch-do-card-do-dev-2>
   docker compose --env-file portas.env up --build -d
   ```
   Abra http://localhost:3020 — **lado a lado** com a do Dev 1, cada uma com o código da sua branch e o seu próprio banco.

4. **Cada dev sobe a sua atualização** (na pasta dele):
   ```bash
   npm ci              # só na 1ª vez, para ter o lint local
   npm run lint
   git add <arquivos>
   git commit -m "feat: ..."
   git push
   ```
   Abra o PR com `Resolve #<número do card>`. O CI roda; o card vai para **Em Revisão**.

5. **Quem chegar depois atualiza a branch antes do merge** — se o outro dev já mesclou:
   ```bash
   git fetch origin
   git rebase origin/main      # se der conflito: docs/EXERCICIO_MULTIPLOS_DEVS.md, passos 5 a 7
   git push --force-with-lease
   ```

6. **Depois do merge, volte para a main atualizada** antes de pegar o próximo card:
   ```bash
   git checkout main && git pull
   ```

## 5. Problemas comuns

| Sintoma | Causa | O que fazer |
|---|---|---|
| `port is already allocated` | Outra cópia já usa a porta, ou esqueceu o `--env-file portas.env` (aí ele tenta 3000/3001/5151, que são da pasta principal) | Use sempre `--env-file portas.env`; confira com `docker ps` |
| A mudança no código não aparece no navegador | O container ainda roda a versão antiga | `docker compose --env-file portas.env up --build -d` e recarregue com Ctrl+F5 |
| O login não funciona | Cada dev tem seu próprio banco | Use `admin@labsystem.com` / `admin123`, ou o usuário que você criou **naquele** banco |
| Commit saiu com o autor errado | Comando rodado na pasta errada | `pwd` e `git config user.name` antes de commitar |
| Quero começar do zero o banco de um dev | — | `docker compose --env-file portas.env down -v` e `up --build -d` de novo |

## 6. Como isto foi montado (para refazer em outra máquina)

```bash
for n in 1 2; do
  mkdir -p ~/devs/dev$n && cd ~/devs/dev$n
  git clone git@github.com:ScaTecnologia/laboratorio-claude-code.git
  cd laboratorio-claude-code
  git config user.name "Dev $n"
  git config user.email "dev$n@example.invalid"
  printf 'COMPOSE_PROJECT_NAME=dev%s\nAPP_PORT=30%s0\nAPI_PY_PORT=30%s1\nPG_PORT=516%s\n' $n $n $n $n > portas.env
done
```

Os commits saem com autor "Dev 1"/"Dev 2", mas o `git push` usa a sua chave SSH (conta ScaTecnologia) — no GitHub aparece o autor do commit e quem fez o push. Com desenvolvedores reais, cada um usa a própria conta GitHub (ver `docs/COLABORACAO_EQUIPE.md`).
