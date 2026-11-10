# syntax=docker/dockerfile:1

# Image de production unique : web (`node bin/server.js`) et worker de queue
# (`node ace queue:work`) ne diffèrent que par la commande. Cf. docs/deploiement.md.
#
# Node 24 LTS (package.json : engines.node >=24), pnpm épinglé comme `packageManager`.
ARG NODE_VERSION=24.20.0
ARG PNPM_VERSION=12.15.0

# ---------------------------------------------------------------------------
# deps : toutes les dépendances (dev comprises), nécessaires au build.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS deps
ARG PNPM_VERSION
ENV HUSKY=0 \
    CI=true
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# build : compilation TypeScript (ace build) + bundle Inertia/Vue (Vite, SSR).
# Sortie dans /app/build, qui embarque son propre package.json / lockfile.
# ---------------------------------------------------------------------------
FROM deps AS build
COPY . .
# `tests/` est exclu du contexte (.dockerignore) : bin/test.ts, l'entrypoint du
# runner Japa, importe tests/bootstrap et ferait échouer tsc. Inutile en prod.
RUN rm -f bin/test.ts && node ace build

# ---------------------------------------------------------------------------
# prod-deps : dépendances de production seules, installées depuis le build.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS prod-deps
ARG PNPM_VERSION
ENV HUSKY=0 \
    CI=true
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app
COPY --from=build /app/build ./
# `ace build` n'embarque pas pnpm-workspace.yaml (patchedDependencies) : requis
# pour que le lockfile reste valide en --frozen-lockfile.
COPY pnpm-workspace.yaml ./
COPY patches ./patches
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --prod --frozen-lockfile --ignore-scripts

# ---------------------------------------------------------------------------
# runtime : ni sources TypeScript, ni devDependencies, ni tests, ni pnpm.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS runtime

# Ghostscript : compression PDF (cf. CLAUDE.md).
# Dictionnaires hunspell : langues sans dictionnaire natif PostgreSQL (#84).
# Paquets Debian bookworm vérifiés par `apt-cache policy` ; non disponibles :
# mk, mt, sq. Estonien : `myspell-et` (pas de `hunspell-et`).
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ghostscript \
        hunspell-bg hunspell-bs hunspell-cs hunspell-hr hunspell-is \
        hunspell-lv hunspell-pl hunspell-sk hunspell-sl hunspell-uk \
        myspell-et \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 10001 app \
    && useradd --system --uid 10001 --gid app --no-create-home --shell /usr/sbin/nologin app

ENV NODE_ENV=production \
    PORT=3333 \
    HOST=0.0.0.0
WORKDIR /app
COPY --from=prod-deps --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/build ./
USER app
EXPOSE 3333

# Commit de l'image, exposé par GET /health (vérification après déploiement).
# En dernier : ne change que cette couche d'un commit à l'autre.
ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}

# Web. Worker : même image, `node ace queue:work`. Migrations : commande
# ponctuelle `node ace migration:run --force` (jamais au démarrage).
CMD ["node", "bin/server.js"]
