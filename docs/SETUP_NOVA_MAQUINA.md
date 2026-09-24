# Levando o laboratório para outra máquina

> Ver `docs/STATUS_LABORATORIO.md` primeiro para saber o que já está pronto e o que falta. Este documento cobre só a parte técnica de "instalar e rodar em outro computador".

---

## 1. O que copiar

A pasta inteira do projeto (`laboratorio-claude-code/`), **exceto** o que já está no `.gitignore` (`node_modules/`, `__pycache__/`, `.pytest_cache/`, `.env*`). Se for copiar manualmente (pen drive, OneDrive, zip) em vez de usar Git, esses itens podem ficar de fora sem problema — são recriados no passo 3.

Se o repositório já estiver no GitHub (ver `docs/ROTEIRO_CICD_CLAUDE_CODE.md`, Passo 1), o jeito mais simples é:

```bash
git clone https://github.com/<seu-usuario>/laboratorio-claude-code.git
```

Se **ainda não** estiver no GitHub, copie a pasta com o `.git` incluído (ele carrega todo o histórico) e pule para o passo 2.

## 2. Pré-requisitos na máquina nova

| Ferramenta | Versão usada neste laboratório | Como checar |
|---|---|---|
| Node.js | 22.x | `node --version` |
| Python | 3.10.x | `python3 --version` |
| Git | qualquer recente | `git --version` |
| PostgreSQL | rodando em `localhost:5151`, banco `laboratorio`, usuário `postgres`, senha `5151` | ver seção 4 |
| Docker | **só se a máquina permitir** (não era o caso na máquina Unisys original) | `docker --version` |
| GitHub CLI (`gh`) | opcional, facilita o Passo 1 do roteiro de CI/CD | `gh --version` |

Não é obrigatório ter exatamente essas versões — o projeto não usa recursos exóticos — mas são as versões validadas nesta sessão.

## 3. Instalar dependências

```bash
cd laboratorio-claude-code

# Node.js — inclui eslint (devDependency) usado pelo lint da esteira
npm install

# Python — requirements-dev.txt já inclui requirements.txt (Flask, psycopg2-binary)
# mais flake8, pytest, bandit, pip-audit
pip install -r requirements-dev.txt
```

## 4. Banco de dados

O projeto espera um PostgreSQL acessível em `localhost:5151`, banco `postgres`/`laboratorio`, usuário `postgres`, senha `5151` (ver `src/db.js` e `CLAUDE.md`). O próprio código cria o banco e as tabelas na inicialização (`garantirBanco()`, `inicializar()`) — não há schema SQL para rodar manualmente.

Se a máquina nova não tiver Postgres instalado localmente:
- **Instalar Postgres nativo** na porta 5151 (ajuste `postgresql.conf` ou use `-p 5151` ao iniciar), ou
- **Se Docker for permitido nesta máquina**: use o `docker-compose.yml` já pronto neste projeto, que sobe um Postgres na porta certa:
  ```bash
  docker compose up postgres -d
  ```
  (não precisa subir os outros serviços do compose só para rodar os testes locais)

## 5. Verificar que está tudo igual — rode a mesma bateria desta sessão

```bash
npm run lint                                    # esperado: 0 erros (alguns avisos são normais)
npm run test:unit                               # esperado: passa (não depende de banco)
npm run test:integration                        # esperado: passa (precisa do Postgres do passo 4)
flake8 src/ tests/ --config=.flake8              # esperado: 0 erros
pytest tests/ -v                                 # esperado: 6 passed
bandit -r src/ -q                                # esperado: 0 issues (nosec já documentados no código)
```

Se algum desses falhar de um jeito diferente do documentado em `docs/STATUS_LABORATORIO.md`, algo mudou entre as máquinas — investigue antes de seguir em frente.

## 6. Rodar a aplicação

```bash
node src/server.js                 # terminal 1 — porta 3000
python src/fornecedores_api.py     # terminal 2 — porta 3001
```

URLs em `CLAUDE.md`.

## 7. O que reconfigurar (não é copiado automaticamente)

| Item | Por quê | Onde fazer |
|---|---|---|
| Remote do GitHub | Git não guarda "a que máquina isso pertence"; se você clonou via HTTPS talvez precise configurar autenticação (token/SSH) na máquina nova | `git remote -v` para conferir, `gh auth login` ou chave SSH nova se necessário |
| Ambiente `production` (Environment do GitHub) | É configuração do repositório no GitHub, não do código — só precisa ser feito uma vez por repositório, não por máquina | `Settings → Environments` (ver `docs/ROTEIRO_CICD_CLAUDE_CODE.md`, Passo 7) |
| Docker/containers | Só ativar se **esta** máquina permitir — releia a regra em `docs/ROTEIRO_CICD_CLAUDE_CODE.md`, Passo 7, antes de mudar qualquer gatilho de workflow | Local: `docker compose up --build`. CI: aba Actions → `docker-build.yml` → Run workflow |
| Credenciais/segredos reais (se algum dia houver) | Nunca ficam no Git | `Settings → Secrets and variables → Actions`, por repositório |

## 8. Se este era um clone via OneDrive/pasta sincronizada

Se a pasta original vivia dentro de uma pasta sincronizada (OneDrive, Google Drive, Dropbox), como era o caso deste laboratório, prefira **não** manter o `.git` dentro de uma pasta sincronizada na máquina nova — sincronização de arquivo por arquivo pode corromper objetos do Git ou prender arquivos de lock (`.git/index.lock`) no meio de uma operação, como aconteceu nesta sessão (ver `docs/STATUS_LABORATORIO.md`, seção 5). Se não for possível evitar, configure a ferramenta de sincronização para ignorar a pasta `.git`.
