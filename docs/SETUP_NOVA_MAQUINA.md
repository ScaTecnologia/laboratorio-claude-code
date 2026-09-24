# Levando o laboratório para outra máquina

> Ver `docs/STATUS_LABORATORIO.md` primeiro para saber o que já está pronto e o que falta. Este documento cobre só a parte técnica de "instalar e rodar em outro computador".

---

## 1. O que copiar

A pasta inteira do projeto (`laboratorio-claude-code/`), **exceto** o que já está no `.gitignore` (`node_modules/`, `__pycache__/`, `.pytest_cache/`, `.env*`). Se for copiar manualmente (pen drive, OneDrive, zip) em vez de usar Git, esses itens podem ficar de fora sem problema — são recriados no passo 3.

O repositório está no GitHub (público), então o jeito mais simples é clonar:

```bash
git clone git@github.com:ScaTecnologia/laboratorio-claude-code.git      # SSH (precisa da chave cadastrada, ver seção 7)
# ou
git clone https://github.com/ScaTecnologia/laboratorio-claude-code.git  # HTTPS (só leitura sem login)
```

Os materiais de curso (`.pptx`, `.zip`, `Aula3_*` etc.) **não estão no Git** (ficam no `.gitignore`) — se precisar deles, copie à parte.

> **Não copie `node_modules/` entre sistemas operacionais** (ex.: Windows → Linux): os binários em `node_modules/.bin/` perdem a permissão de execução e o `npm run lint` passa a usar um ESLint antigo do sistema, com erro de configuração. Sempre recrie com `npm ci`.

## 2. Pré-requisitos na máquina nova

| Ferramenta | Versão usada neste laboratório | Como checar |
|---|---|---|
| Node.js | 24.x (LTS) | `node --version` |
| Python | 3.13.x | `python3 --version` |
| Git | qualquer recente | `git --version` |
| PostgreSQL | rodando em `localhost:5151`, banco `laboratorio`, usuário `postgres`, senha `5151` | ver seção 4 |
| Docker + Compose | recomendado — sobe Postgres + Node + Python com um comando (ver seção 6). Seu usuário precisa estar no grupo `docker` | `docker --version`, `docker compose version` |
| GitHub CLI (`gh`) | recomendado — usado para rulesets, board, PRs. Sem sudo: baixar o binário oficial de github.com/cli/cli/releases (conferindo o checksum) para `~/.local/bin` | `gh --version` |

Não é obrigatório ter exatamente essas versões — o projeto não usa recursos exóticos — mas são as versões validadas nesta sessão.

## 3. Instalar dependências

```bash
cd laboratorio-claude-code

# Node.js — inclui eslint (devDependency) usado pelo lint da esteira
npm ci

# Python — requirements-dev.txt já inclui requirements.txt (Flask, psycopg2-binary)
# mais flake8, pytest, bandit, pip-audit. Prefira um venv:
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
```

Se o Python do sistema não tiver `venv`/`pip` (comum no Ubuntu sem o pacote `python3-venv`) e você não puder instalar, rode as ferramentas Python num container descartável — é o que foi feito na máquina Linux em 2026-09-24:

```bash
docker run --rm -v "$PWD":/app:ro -w /app -e PYTHONDONTWRITEBYTECODE=1 python:3.13-slim sh -c \
  "pip install -q -r requirements-dev.txt && flake8 src/ tests/ --config=.flake8 && pytest tests/ -q -p no:cacheprovider && bandit -r src/ -q"
```

## 4. Banco de dados

O projeto espera um PostgreSQL acessível em `localhost:5151`, banco `postgres`/`laboratorio`, usuário `postgres`, senha `5151` (ver `src/db.js` e `CLAUDE.md`). O próprio código cria o banco e as tabelas na inicialização (`garantirBanco()`, `inicializar()`) — não há schema SQL para rodar manualmente.

Se a máquina nova não tiver Postgres instalado localmente:
- **Instalar Postgres nativo** na porta 5151 (ajuste `postgresql.conf` ou use `-p 5151` ao iniciar), ou
- **Com Docker** (recomendado): use o `docker-compose.yml`, que sobe um Postgres na porta certa (publicado só em `127.0.0.1`):
  ```bash
  docker compose up postgres -d
  ```
  (não precisa subir os outros serviços do compose só para rodar os testes locais)

## 5. Verificar que está tudo igual — rode a mesma bateria desta sessão

```bash
npm run lint                                    # esperado: 0 problemas
npm run test:unit                               # esperado: passa (não depende de banco)
npm run test:integration                        # esperado: passa (precisa do Postgres do passo 4)
flake8 src/ tests/ --config=.flake8              # esperado: 0 erros
pytest tests/ -v                                 # esperado: 6 passed
bandit -r src/ -q                                # esperado: 0 issues (nosec já documentados no código)
```

Se algum desses falhar de um jeito diferente do documentado em `docs/STATUS_LABORATORIO.md`, algo mudou entre as máquinas — investigue antes de seguir em frente.

## 6. Rodar a aplicação

**Com Docker** (tudo de uma vez):

```bash
docker compose up --build -d       # postgres (5151), node (3000), fornecedores (3001)
docker compose down                # derrubar
```

**Sem Docker** (Postgres local na 5151 já rodando):

```bash
node src/server.js                 # terminal 1 — porta 3000
python src/fornecedores_api.py     # terminal 2 — porta 3001
```

Não rode as duas formas ao mesmo tempo — elas disputam as portas 3000, 3001 e 5151.

URLs em `CLAUDE.md`.

## 7. O que reconfigurar (não é copiado automaticamente)

| Item | Por quê | Onde fazer |
|---|---|---|
| Chave SSH | Cada máquina tem a sua. Gere com `ssh-keygen -t ed25519 -C "seu@email"` e cadastre o `.pub` em GitHub → Settings → SSH and GPG keys | Teste: `ssh -T git@github.com` (fingerprint oficial do GitHub: `SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU`) |
| Login do `gh` | O token fica no keyring da máquina, não no repositório | `gh auth login -h github.com -p ssh --skip-ssh-key -w -s project,admin:repo_hook,workflow` |
| Ruleset da `main`, Environment `production`, Dependabot, CodeQL, board Kanban | São configurações do **repositório no GitHub**, não da máquina — já estão feitas, não precisa repetir | Conferir em `Settings → Rules`, `Settings → Environments`, `Settings → Code security` |
| Credenciais/segredos reais (se algum dia houver) | Nunca ficam no Git | `Settings → Secrets and variables → Actions`, por repositório |

## 8. Se este era um clone via OneDrive/pasta sincronizada

Se a pasta original vivia dentro de uma pasta sincronizada (OneDrive, Google Drive, Dropbox), como era o caso deste laboratório, prefira **não** manter o `.git` dentro de uma pasta sincronizada na máquina nova — sincronização de arquivo por arquivo pode corromper objetos do Git ou prender arquivos de lock (`.git/index.lock`) no meio de uma operação, como aconteceu nesta sessão (ver `docs/STATUS_LABORATORIO.md`, seção 5). Se não for possível evitar, configure a ferramenta de sincronização para ignorar a pasta `.git`.
