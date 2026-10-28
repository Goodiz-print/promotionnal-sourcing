# Développement local : image de production et services

> Dernière mise à jour : 2026-10-16

Deux usages distincts, un même `docker-compose.yml` :

| Usage                        | Commande                                     | Services                                 |
| ---------------------------- | -------------------------------------------- | ---------------------------------------- |
| Dev courant (`pnpm dev`)     | `docker compose up -d`                       | `postgres` (port 5440), `s3` (port 9090) |
| Image de production en local | `docker compose --profile app up -d --build` | + `migrate`, `web`, `worker`             |
| Tests                        | `pnpm test:db`                               | `postgres_test` (port 5441, tmpfs)       |

## Prérequis hors Docker : Ghostscript

Avec `pnpm dev` (hors image de production), les PDF des fournisseurs sont compressés par Ghostscript, qui doit être installé sur la machine :

```bash
brew install ghostscript
```

Sans `gs`, tout fonctionne : le PDF est stocké tel quel et un warning est loggé (cf. [`storage.md`](storage.md)). L'image de production l'installe déjà (`Dockerfile`, étape `runtime`).

## Premier lancement de l'image locale

```bash
cp .env.compose.example .env.compose
# remplacer APP_KEY par la sortie de : node ace generate:key
docker compose --profile app up -d --build
docker compose --profile app ps        # migrate doit être « exited (0) »
```

Ordre de démarrage : `postgres` et `s3` sont prêts, `migrate` applique les
migrations puis s'arrête, `web` et `worker` démarrent ensuite.

- Web : http://localhost:3333 (changer le port avec `WEB_PORT=3334 docker compose ...`).
- Logs : `docker compose --profile app logs -f web worker`.
- Relancer les migrations seules : `docker compose --profile app run --rm migrate`.

## Limites par rapport à la production

- **Stockage** : S3Mock au lieu de Cellar. Mêmes variables `CELLAR_*`, mais aucune
  authentification : ne pas tester les droits d'accès sur ce service.
- **`NODE_ENV=production`** est forcé pour tester le comportement de l'image. Les
  clés de stockage sont donc préfixées `promotionnal-sourcing/production/` dans S3Mock.
- **IA et mails** : désactivés ou non joignables. Aucun envoi réel.
- **Données** : le volume `promotionnal-sourcing_pg_data` persiste entre les lancements.

## Réinitialiser

```bash
docker compose --profile app down        # arrête, garde les données
docker compose down -v                   # arrête et supprime PostgreSQL et S3Mock
```

## Vérifications avant un déploiement

- `docker compose --profile app config` valide le fichier.
- `migrate` se termine avec le code 0.
- `web` répond sur son port publié et son healthcheck passe (`docker compose --profile app ps`).
- `worker` démarre sans erreur de connexion à la base.
