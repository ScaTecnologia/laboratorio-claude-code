# Documentação Técnica — laboratorio-claude-code

## Visão Geral

Aplicação Node.js que expõe uma API REST para gerenciamento de usuários (CRUD), com persistência em banco de dados PostgreSQL e interface web para uso via navegador. A documentação interativa das APIs está disponível via Swagger UI.

---

## Stack Tecnológica

| Camada       | Tecnologia              |
|--------------|-------------------------|
| Runtime      | Node.js (CommonJS)      |
| Servidor HTTP | `http` (módulo nativo) |
| Banco de dados | PostgreSQL             |
| Driver DB    | `pg` (node-postgres)    |
| Frontend     | HTML + CSS + JavaScript puro |
| API Docs     | Swagger UI (via CDN)    |

---

## Arquitetura

```
Navegador
    │
    ▼
src/server.js          ← Roteamento HTTP e ponto de entrada
    │
    ├── src/usuarios.js ← Lógica de negócio (CRUD)
    │       │
    │       └── src/db.js ← Conexão com PostgreSQL
    │
    └── src/public/
            ├── index.html    ← Interface web
            ├── swagger.html  ← Swagger UI
            └── swagger.json  ← Especificação OpenAPI
```

---

## Estrutura de Arquivos

### `src/server.js`
Ponto de entrada da aplicação. Responsável por:
- Criar e iniciar o servidor HTTP na porta `3000`
- Rotear as requisições para os handlers corretos
- Servir os arquivos estáticos (frontend e Swagger)
- Chamar `inicializar()` ao subir, garantindo que banco e tabela existam

**Rotas registradas:**

| Método | Rota          | Descrição                        |
|--------|---------------|----------------------------------|
| GET    | `/`           | Serve a interface web            |
| GET    | `/api-docs`   | Serve o Swagger UI               |
| GET    | `/swagger.json` | Serve a especificação OpenAPI  |
| GET    | `/usuarios`   | Lista todos os usuários          |
| GET    | `/usuarios/:id` | Retorna um usuário por ID      |
| POST   | `/usuarios`   | Cria um novo usuário             |
| PUT    | `/usuarios/:id` | Atualiza um usuário por ID     |
| DELETE | `/usuarios/:id` | Remove um usuário por ID       |

---

### `src/usuarios.js`
Módulo de negócio. Contém todas as funções do CRUD de usuários, realizando as operações diretamente no banco de dados via queries SQL parametrizadas.

| Função           | Descrição                                              |
|------------------|--------------------------------------------------------|
| `inicializar()`  | Garante criação do banco e da tabela `usuarios`        |
| `criar(nome, email)` | Insere um novo registro e retorna o objeto criado  |
| `listar()`       | Retorna todos os usuários ordenados por ID             |
| `buscar(id)`     | Retorna um usuário pelo ID ou `null` se não existir    |
| `atualizar(id, dados)` | Atualiza campos fornecidos e retorna o registro  |
| `deletar(id)`    | Remove o registro e retorna `true` ou `false`          |

---

### `src/db.js`
Módulo de conexão com o PostgreSQL. Gerencia dois pools de conexão:

- **Pool admin** (`postgres`): usado apenas na inicialização para verificar e criar o banco `laboratorio` caso não exista
- **Pool da aplicação** (`laboratorio`): utilizado por todas as operações de negócio

**Configuração de conexão:**

| Parâmetro | Valor       |
|-----------|-------------|
| Host      | `localhost` |
| Porta     | `5151`      |
| Banco     | `laboratorio` |
| Usuário   | `postgres`  |

---

### `src/public/index.html`
Interface web completa para uso do CRUD via navegador. Funciona consumindo as APIs REST do servidor. Funcionalidades:
- Formulário para criar e editar usuários
- Tabela com listagem de todos os usuários
- Botões de editar e deletar por linha
- Mensagens de feedback de sucesso e erro

---

### `src/public/swagger.html`
Página do Swagger UI carregada via CDN. Consome o arquivo `swagger.json` para renderizar a interface interativa de documentação das APIs.

---

### `src/public/swagger.json`
Especificação OpenAPI 3.0 de todas as rotas da API. Define os endpoints, métodos HTTP, parâmetros, schemas de request/response e exemplos. É a fonte de verdade para a documentação da API.

---

### `src/soma.js`
Módulo utilitário com a função `soma(a, b)`. Criado durante a fase inicial do laboratório para demonstrar a estrutura de módulos e testes.

---

### `src/soma.test.js` e `src/usuarios.test.js`
Suítes de testes unitários usando o módulo nativo `assert` do Node.js. Não requerem frameworks externos.

> **Atenção:** `usuarios.test.js` foi escrito para a versão in-memory de `usuarios.js`. Após a migração para PostgreSQL, os testes precisam ser atualizados para usar um banco de testes.

---

## Banco de Dados

### Schema

```sql
CREATE TABLE IF NOT EXISTS usuarios (
  id    SERIAL PRIMARY KEY,
  nome  TEXT NOT NULL,
  email TEXT NOT NULL
);
```

A tabela é criada automaticamente na inicialização da aplicação se não existir.

---

## Como Executar

### Pré-requisitos
- Node.js instalado
- PostgreSQL rodando em `localhost:5151`

### Instalação

```bash
npm install
```

### Iniciar o servidor

```bash
node src/server.js
```

### URLs disponíveis

| URL                          | Descrição          |
|------------------------------|--------------------|
| `http://localhost:3000`      | Interface web      |
| `http://localhost:3000/api-docs` | Swagger UI     |
| `http://localhost:3000/usuarios` | API REST       |

---

## Como Executar os Testes

```bash
node src/soma.test.js
node src/usuarios.test.js
```

---

## Dependências

| Pacote | Versão   | Uso                              |
|--------|----------|----------------------------------|
| `pg`   | `^8.21.0` | Driver de conexão com PostgreSQL |
