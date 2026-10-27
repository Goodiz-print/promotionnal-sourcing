# Déploiement

> Hébergement : **Clever Cloud** (ADR 0003). Suivi : #78 (CI/CD, sauvegardes).

## Environnements

| Environnement | Applications                           | PostgreSQL             | Cellar                    | Meilisearch                           | Déclenchement                       |
| ------------- | -------------------------------------- | ---------------------- | ------------------------- | ------------------------------------- | ----------------------------------- |
| Dev (local)   | `pnpm dev:all` sur le poste            | Conteneur local        | S3Mock (`localhost:9090`) | À confirmer dans `docker-compose.yml` | Manuel                              |
| Staging       | Docker XS (web), Docker XS (worker)    | PostgreSQL XS Small    | Bucket staging            | Docker XS (test)                      | Push sur `main`                     |
| Production    | Docker XS ×2 (web), Docker XS (worker) | PostgreSQL S Big Space | Bucket prod               | Docker M                              | Tag `vX.Y.Z` + approbation manuelle |

## Règles

- **Staging** : déploiement automatique à chaque push sur `main`.
- **Prod** : déploiement uniquement sur un tag `vX.Y.Z`, après approbation manuelle (environnement GitHub `production`).
- **Une image par commit** : construite et testée une fois par la CI, taguée au SHA. La prod réutilise cette image, sans rebuild.

## Release

1. Merge sur `main`. La CI teste, construit `app:<sha>`, déploie en staging.
2. Vérification sur staging.
3. `git tag vX.Y.Z && git push origin vX.Y.Z`.
4. La CI attend l'approbation du job `production`.
5. Sur approbation : migrations, puis déploiement de l'image sur Clever Cloud avec `clever deploy --tag vX.Y.Z` (applications web et worker).

## Image Docker

Un seul `Dockerfile` (racine) pour l'application web **et** le worker de queue : même image, commande différente.

- Base `node:24.20.0-bookworm-slim` (Node 24 LTS, `engines.node >=24`), pnpm `11.9.0` via corepack (version du champ `packageManager`).
- Étapes : `deps` (toutes les dépendances) → `build` (`node ace build` : TypeScript + bundle Vite/SSR) → `prod-deps` (`pnpm install --prod --frozen-lockfile`) → `runtime` (ni sources TS, ni devDependencies, ni tests, ni pnpm).
- Runtime : Ghostscript (compression PDF), dictionnaires hunspell (voir ci-dessous), utilisateur non root `app` (uid 10001), `PORT=3333`, `HOST=0.0.0.0`.
- Aucun secret dans l'image : toutes les variables (voir `.env.example`) viennent de l'environnement d'exécution. L'application refuse de démarrer si une variable obligatoire manque.
- Sondes : `GET /health` (web, 200 si la base répond, 503 sinon) et `node ace queue:health` (worker, sortie 1 si des jobs sont en retard ou figés). Voir `docs/queue.md`.

### Construire

```bash
docker build -t app:$(git rev-parse --short HEAD) .
docker image ls app   # taille de l'image
```

`tests/` est exclu du contexte (`.dockerignore`) ; le `Dockerfile` retire donc `bin/test.ts` avant `ace build`.

### Démarrer les processus

Sur Clever Cloud, chaque processus est une application distincte qui partage le même dépôt :

- **Web** : commande par défaut de l'image (`HOST=0.0.0.0`, port `3333`).
- **Worker** : `node ace queue:work` (les mails, les purges Cellar et la génération des miniatures en dépendent, voir `docs/queue.md`).

Les variables d'environnement sont définies par application sur Clever Cloud. Les variables `CELLAR_ADDON_*` de l'add-on sont mappées vers `CELLAR_ENDPOINT`, `CELLAR_BUCKET`, `CELLAR_ACCESS_KEY_ID` et `CELLAR_SECRET_ACCESS_KEY` (voir `docs/storage.md`).

### Migrations

Lancées **avant** le redémarrage des applications, par la CI, jamais au démarrage de l'image :

```bash
node ace migration:run --force
```

Une migration déjà exécutée ne se modifie jamais. Le `down()` ne se lance pas automatiquement.

### Dictionnaires hunspell (#84)

Installés dans `/usr/share/hunspell` : bg, bs, cs, hr, is, lv, pl, sk, sl, uk (`hunspell-xx`) et et (`myspell-et`). **Non disponibles dans Debian bookworm : mk, mt, sq** (repli `simple`).

> ⚠️ PostgreSQL lit ses dictionnaires (`.dict` / `.affix`) dans `$SHAREDIR/tsearch_data` **sur le serveur de base**, pas dans le conteneur applicatif. Sur la base managée Clever Cloud, ces fichiers de l'image n'ont aucun effet sur la recherche plein texte. À confirmer auprès du support : dépôt possible côté serveur ou repli sur `simple`.

## Meilisearch (#112)

Moteur de recherche hybride, distinct de l'application web. Hébergement : **Meilisearch Cloud** ou **instance Docker Clever Cloud** (Docker M en prod) avec volume confirmé — voir [ADR 0004](adr/0004-maintien-meilisearch-hebergement.md).

- Image officielle `getmeili/meilisearch`, version épinglée (jamais `latest`).
- Données sur un volume persistant. Volume à confirmer sur instance Docker Clever Cloud.
- Sauvegarde : snapshot Meilisearch planifié, copié hors de la plateforme.
- Clé master et clé API de l'application : variables `MEILISEARCH_HOST` et `MEILISEARCH_API_KEY`, validées dans `start/env.ts`, documentées dans `.env.example`. Jamais dans l'image.
- Sonde : `GET /health` sur le port du moteur.
- **Modèle d'embeddings (défaut `huggingface`)** : Meilisearch télécharge le modèle (~1 Go pour `multilingual-e5-base`) depuis Hugging Face au premier usage, puis le garde sur son volume — l'instance doit pouvoir joindre Hugging Face en sortie et garder ses données entre redéploiements, sinon le modèle est retéléchargé. Il calcule aussi les vecteurs sur son CPU : prévoir plus que l'instance Docker M (4 Go), à dimensionner par la mesure (`node ace search:reindex`, puis `search:evaluate`). Un provider API (`AI_PROVIDER=mistral`) évite ce dimensionnement, au prix d'une clé et d'un coût par token.
- Source de vérité : PostgreSQL. Un index corrompu ou perdu se reconstruit par réindexation complète (commande dédiée, rejouable), sans perte de données.
- Les mises à jour de version Meilisearch passent par une réindexation si la release l'exige : la noter dans le changelog.

#### Dimensionnement de l'instance Meilisearch

Meilisearch tourne sur une **instance dédiée** : l'inférence ne concurrence ni le web ni le worker, et si l'instance sature le catalogue retombe sur la recherche PostgreSQL. Ces chiffres sont des **points de départ estimés, non mesurés** — à confirmer par un vrai `search:reindex` en observant mémoire et CPU.

| Modèle (`HF_EMBED_MODEL`)                | Usage                           | Point de départ                 |
| ---------------------------------------- | ------------------------------- | ------------------------------- |
| `intfloat/multilingual-e5-base` (défaut) | Qualité multilingue             | ~4 Go de RAM, 2 vCPU (flavor L) |
| `intfloat/multilingual-e5-small`         | Si le CPU ou la RAM pèsent trop | Plus petit (flavor M à valider) |
| `AI_PROVIDER=mistral` (REST)             | Aucun calcul local              | Dimensionner pour l'index seul  |

- **CPU, sans GPU** : l'indexation initiale et chaque modification de fiche calculent des vecteurs ; chaque recherche calcule celui de la requête (quelques dizaines à centaines de ms selon le CPU).
- **Volume persistant obligatoire** pour le modèle (~1 Go) : sans lui, il est retéléchargé à chaque redéploiement, avec un démarrage à froid lent.
- **Sortie réseau vers Hugging Face** à ouvrir pour cette instance seulement.
- **Changer de modèle** change les vecteurs : réindexer (`node ace search:reindex`) puis rejouer `search:evaluate`.
- Vérifier après déploiement : mémoire stable après le premier `search:reindex`, latence de recherche, et `search:evaluate` au vert.

### Développement local

Le service `meilisearch` du `docker-compose.yml` démarre avec les autres services de dev (sans profil) :

```bash
docker compose up -d
```

`pnpm dev:all` le démarre également, avec Postgres, S3, le worker et le serveur.

Sonde : <http://localhost:7700/health> (`{"status":"available"}`). La clé master vient de `MEILI_MASTER_KEY` dans `.env` (voir `.env.example`) ; données dans le volume `promotionnal-sourcing_meili_data`.

## Temps réel (Transmit)

Avec plusieurs instances web, définir **`TRANSMIT_TRANSPORT=postgres`** sur chacune
(staging et production) : sans cela, une notification n'atteint que les navigateurs
connectés à l'instance qui l'a créée. Le transport relaie par `LISTEN` / `NOTIFY` sur la
base PostgreSQL existante (détails : [`entites-transverses.md`](entites-transverses.md)).

- **Connexions** : +2 par instance web (écoute dédiée + une connexion de publication),
  à compter dans la limite de connexions de la base managée. Le worker n'en ouvre aucune.
- **À valider sur Clever Cloud** (non testé en conditions réelles) : que la connexion
  d'écoute survive aux coupures idle de la plateforme (le transport se reconnecte seul et
  le loggue), et qu'aucun pooler en mode transaction n'est placé devant la base.
- Sans la variable (dev, tests, instance unique), le transport reste en mémoire.

## Base de données

- Version : PostgreSQL 18 (Clever Cloud).
- Extensions `vector` (pgvector), `pg_trgm` et `unaccent` : à activer via le support Clever Cloud. Ne pas exécuter `CREATE EXTENSION` sans accord du support.
- Sauvegardes quotidiennes incluses, rétention 7 jours. Restauration à un instant donné (pgBackRest) disponible sur demande, à activer si le catalogue devient critique.
- Réplication Leader-Follower : sur demande, non prévue au lancement.

## Rollback

Redéployer le tag précédent :

```bash
clever deploy --tag v1.3.2
```

Si la release contenait une migration destructive, le rollback applicatif ne suffit pas.

## Secrets

- Secrets GitHub : token Clever Cloud pour le déploiement (`CLEVER_TOKEN`, `CLEVER_SECRET`), identifiants du registre si utilisé, clé API Meilisearch.
- Variables Clever Cloud : une liste par application (web, worker), jamais committée.
- `.env` local : jamais committé.
