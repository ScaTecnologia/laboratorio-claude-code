# ============================================================================
# Dockerfile — serviço Node.js (src/server.js)
# ----------------------------------------------------------------------------
# Uso normal: `docker compose up --build` (sobe Postgres + Node + Python).
# Isolado:    docker build -t labsystem-node .
# ============================================================================
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
# Usuário não-root — boa prática de segurança de contêiner.
RUN addgroup -S app && adduser -S app -G app \
    # O runtime só precisa do `node`. O npm embutido na imagem base traz
    # dependências próprias com CVEs HIGH que o Trivy acusaria.
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
USER app
EXPOSE 3000
CMD ["node", "src/server.js"]
