# syntax=docker/dockerfile:1

# ---------- Build stage ----------
FROM node:24-alpine AS build
WORKDIR /app

ENV CI=true

COPY package.json package-lock.json ./
RUN --mount=type=cache,id=trolleybus-npm-cache,target=/root/.npm \
    npm ci --no-audit --no-fund

COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
COPY public ./public
RUN npm run build

# ---------- Runtime stage ----------
FROM node:24-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4200
ENV NO_UPDATE_CHECK=1

COPY package.json package-lock.json ./
RUN --mount=type=cache,id=trolleybus-npm-cache,target=/root/.npm \
    npm ci --omit=dev --no-audit --no-fund

COPY --from=build --chown=node:node /app/dist ./dist

USER node

EXPOSE 4200

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4200) + '/', { signal: AbortSignal.timeout(4000) }).then(async response => { if (!response.ok) throw new Error('HTTP ' + response.status); await response.arrayBuffer(); process.exit(0); }).catch(error => { console.error('Healthcheck failed:', error); process.exit(1); })"

CMD ["node", "node_modules/serve/build/main.js", "--single", "--no-clipboard", "dist"]
