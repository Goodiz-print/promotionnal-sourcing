# Déploiement

> Proposition, à valider. Hébergement : Scaleway (#80). Suivi : #78, #86.

## Règles

- **Staging** : déploiement automatique à chaque push sur `main`.
- **Prod** : déploiement uniquement sur un tag `vX.Y.Z`, après approbation manuelle.
- **Une image par commit** : construite et testée une fois par la CI, taguée au SHA. La prod réutilise cette image, sans rebuild.

## Release

1. Merge sur `main`. La CI teste, construit `app:<sha>`, déploie en staging.
2. Vérification sur staging.
3. `git tag vX.Y.Z && git push origin vX.Y.Z`.
4. La CI retague l'image et attend l'approbation du job `production`.
5. Sur approbation : `docker compose pull`, migrations, `docker compose up -d`.

## Image Docker

Un seul `Dockerfile` (racine) pour l'application web **et** le worker de queue : même image, commande différente.

- Base `node:24.20.0-bookworm-slim` (Node 24 LTS, `engines.node >=24`), pnpm `11.9.0` via corepack (version du champ `packageManager`).
- Étapes : `deps` (toutes les dépendances) → `build` (`node ace build` : TypeScript + bundle Vite/SSR) → `prod-deps` (`pnpm install --prod --frozen-lockfile`) → `runtime` (ni sources TS, ni devDependencies, ni tests, ni pnpm).
- Runtime : Ghostscript (compression PDF), dictionnaires hunspell (voir ci-dessous), utilisateur non root `app` (uid 10001), `PORT=3333`, `HOST=0.0.0.0`.
- Aucun secret dans l'image : toutes les variables (voir `.env.example`) viennent de l'environnement d'exécution. L'application refuse de démarrer si une variable obligatoire manque.
- Sondes : `GET /health` (web, 200 si la base répond, 503 sinon) et `node ace queue:health` (worker, sortie 1 si des jobs sont en retard ou figés). Healthchecks déclarés dans `docker-compose.yml` ; voir `docs/queue.md`.

### Construire

```bash
docker build -t app:$(git rev-parse --short HEAD) .
docker image ls app   # taille de l'image
```

`tests/` est exclu du contexte (`.dockerignore`) ; le `Dockerfile` retire donc `bin/test.ts` avant `ace build`.

### Lancer

```bash
# Web (CMD par défaut)
docker run -d --env-file .env.prod -p 3333:3333 app:<tag>

# Worker de queue : même image, autre commande (les mails en dépendent, cf. docs/queue.md)
docker run -d --env-file .env.prod app:<tag> node ace queue:work

# Migrations : conteneur ponctuel, avant le redémarrage, jamais au démarrage de l'image
docker run --rm --env-file .env.prod app:<tag> node ace migration:run --force
```

### Dictionnaires hunspell (#84)

Installés dans `/usr/share/hunspell` : bg, bs, cs, hr, is, lv, pl, sk, sl, uk (`hunspell-xx`) et et (`myspell-et`). **Non disponibles dans Debian bookworm : mk, mt, sq** (repli `simple`).

> ⚠️ PostgreSQL lit ses dictionnaires (`.dict` / `.affix`) dans `$SHAREDIR/tsearch_data` **sur le serveur de base**, pas dans le conteneur applicatif. Avec une base managée (#78), ces fichiers de l'image n'ont aucun effet sur la recherche plein texte : ils doivent être déposés côté PostgreSQL (et convertis en UTF-8 minuscules, noms `xx_xx.dict`/`.affix`).

## Migrations

- Lancées avant le redémarrage : `docker compose run --rm app node ace migration:run --force`.
- Une migration déjà exécutée ne se modifie jamais. Le `down()` ne se lance pas automatiquement.

## Rollback

```bash
IMAGE_TAG=v1.3.2 docker compose up -d
```

Si la release contenait une migration destructive, le rollback applicatif ne suffit pas.

## Secrets

- GitHub Secrets : clé SSH de déploiement, identifiants du registre, hôte du VPS.
- `.env` sur le VPS : jamais committé.
