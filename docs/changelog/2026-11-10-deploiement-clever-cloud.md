# Déploiement Clever Cloud : staging et production

> Date : 2026-11-10

Mise en place du pipeline de déploiement sur Clever Cloud (#78). Décisions dans l'ADR 0005, fonctionnement dans `docs/deploiement.md`, mise en place initiale dans `docs/deploiement-clever-setup.md`.

## Principe

Clever Cloud ne déploie pas une image : une application Docker reconstruit le `Dockerfile` qu'on lui pousse. La CI construit donc l'image une fois par commit de `main` (GHCR, taguée au SHA), puis pousse sur chaque application un `Dockerfile` d'une ligne `FROM …@sha256:<digest>`. Staging et production exécutent le même binaire.

## Commande `queue:serve`

- `node ace queue:serve` : `queue:work` (mêmes options) plus une sonde HTTP `GET /health` sur `HOST:PORT`, exigée par Clever Cloud pour tout conteneur.
- Sonde de vie : 200 `{ "status": "ok" }` tant que le processus tourne, 404 ailleurs. Elle ne regarde ni la base ni le backlog ; `node ace queue:health` reste la sonde métier.
- `WorkerProbeService` (`app/services/worker_probe_service.ts`), tests dans `tests/unit/worker_probe_service.spec.ts`.
- En local et dans le compose, `queue:work` reste la commande du worker.

## Workflows GitHub Actions

- `docker.yml` : construit et pousse l'image du **commit validé par la CI** (et non plus la tête de `main`), avec un nom de dépôt en minuscules (GHCR refuse les majuscules de `Goodiz-print`). Déploie ensuite en staging si la variable de dépôt `DEPLOY_STAGING` vaut `true`.
- `release.yml` (nouveau) : sur un tag `vX.Y.Z`, pose ce tag sur l'image du commit, puis déploie en production après approbation de l'environnement `production`. Lancé à la main avec un tag existant, il sert de rollback.
- `deploy.yml` (nouveau, réutilisable) : migrations, web, worker, puis vérification de `GET /health`. Un seul déploiement à la fois par environnement.
- `ci.yml` : nouveau job `lint-ci`, qui passe shellcheck sur `scripts/deploy/*.sh` et `scripts/dev.sh`, et actionlint sur tous les workflows.

## Scripts (`scripts/deploy/`)

- `clever_push.sh` : déploie une image (par digest) sur une application, rôle `web` ou `worker`.
- `clever_migrate.sh` : lance `migration:run --force` et `queue:migrate` dans l'image à déployer, avec les variables lues sur l'application web Clever. Aucun identifiant de base dans GitHub.
- `clever_provision.sh <staging|production>` : crée ou réaligne applications, add-ons, tailles et variables non secrètes à partir de `environments/<environnement>.env`. Idempotent ; génère `APP_KEY` une fois ; liste les secrets à poser à la main.
- Les trois acceptent `--dry-run`.

## Comportements notables

- Domaine de production : `promotional-sourcing.eu` (`scripts/deploy/environments/production.env`) ; staging sur `ps-staging.cleverapps.io`.
- Rien ne se déploie tant que `DEPLOY_STAGING` n'est pas définie et que les environnements GitHub ne sont pas créés.
- Les reviews par PR (sur label `review`) sont décidées dans l'ADR 0005 mais pas encore livrées : elles dépendent de l'activation des extensions PostgreSQL sur un add-on créé à la volée.
- Une application Docker Clever Cloud n'a pas de volume persistant : Meilisearch ne peut pas y être hébergé durablement (ADR 0004, `docs/deploiement.md`).
- Non vérifié contre Clever Cloud : les scripts ont été testés à blanc et contre un faux `clever`.
