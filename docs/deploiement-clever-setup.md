# Mise en place de Clever Cloud

> À faire une fois par environnement. Fonctionnement courant : [`deploiement.md`](deploiement.md). Décisions : [ADR 0005](adr/0005-environnements-et-deploiement.md).

`scripts/deploy/clever_provision.sh` crée les applications, les add-ons et les variables. Ce qui suit est ce qu'il ne peut pas faire à ta place, dans l'ordre.

## 1. Organisation et accès (manuel)

1. Tout vit dans l'organisation Clever Cloud « Promotional Sourcing » (`CLEVER_ORG` dans `scripts/deploy/environments/*.env`). La créer dans la console si elle n'existe pas : le script ne le fait pas.
2. Créer un utilisateur Clever de CI, membre de cette organisation. Se connecter avec lui (`clever login`) et relever `token` et `secret` dans `~/.config/clever-cloud/clever-tools.json`.
3. Créer un jeton GitHub `read:packages` (compte de service de préférence) : il permet aux applications Clever de tirer l'image sur GHCR.

## 2. Provisioning (script)

Prérequis sur le poste : `clever-tools` (`npm install --global clever-tools`), `jq`, `openssl`.

```bash
clever login                                        # avec un compte qui administre l'organisation
scripts/deploy/clever_provision.sh staging --dry-run   # affiche les commandes, ne touche à rien
scripts/deploy/clever_provision.sh staging
```

Pour la production : `clever_provision.sh production` (domaine `promotional-sourcing.eu`, voir « Base, stockage et DNS »).

Le script :

- crée `<préfixe>-web` et `<préfixe>-worker` (Docker), `<préfixe>-pg` (PostgreSQL) et `<préfixe>-cellar`, et lie les add-ons aux deux applications ;
- règle tailles, nombre d'instances, HTTPS forcé et domaine ;
- pose les variables non secrètes (`PORT=8080`, `HOST=0.0.0.0`, `APP_URL`, `QUEUE_DRIVER=database`, `LIMITER_STORE=database`, `CC_DOCKER_LOGIN_SERVER=ghcr.io`…) et `TRANSMIT_TRANSPORT=postgres` dès qu'il y a plusieurs instances web ;
- recopie les identifiants des add-ons vers `DB_*` et `CELLAR_*` ;
- génère `APP_KEY` si elle n'existe pas, identique sur web et worker, sans jamais l'afficher ni la régénérer ;
- liste les secrets manquants et les valeurs à reporter dans GitHub.

Il est idempotent : le relancer après avoir modifié `environments/<environnement>.env` réaligne l'environnement. Une variable modifiée ne s'applique qu'au redémarrage suivant de l'application (le prochain déploiement suffit).

Les identifiants de plan PostgreSQL (`PG_PLAN`) sont à vérifier avant le premier lancement : `clever addon providers show postgresql-addon`.

## 3. Secrets des applications (manuel)

Le script affiche les commandes exactes. Sur **web et worker** :

| Variable                                                                 | Valeur                                                      |
| ------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `CC_DOCKER_LOGIN_USERNAME`                                               | Compte GitHub du jeton `read:packages`                      |
| `CC_DOCKER_LOGIN_PASSWORD`                                               | Le jeton `read:packages`                                    |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`                                  | Staging : un SMTP bac à sable, jamais le SMTP de production |
| `SMTP_USERNAME`, `SMTP_PASSWORD`                                         | Selon le fournisseur SMTP                                   |
| `MISTRAL_API_KEY`, `MEILISEARCH_*`, `HEALTH_TOKEN`, `MAIL_ALERT_ADDRESS` | Optionnels, voir `.env.example`                             |

Sans `MEILISEARCH_HOST`, la recherche fonctionne sur PostgreSQL seul.

## 4. Base, stockage et DNS (manuel)

1. **Extensions PostgreSQL** : demander au support Clever Cloud l'activation de `vector`, `pg_trgm` et `unaccent` sur l'add-on. Ne pas lancer `CREATE EXTENSION` sans son accord. Les migrations échouent tant que ce n'est pas fait.
2. **Bucket Cellar** : créer le bucket nommé dans `CELLAR_BUCKET` (console Clever, ou tout client S3 avec les identifiants de l'add-on).
3. **DNS de la production** : `promotional-sourcing.eu` est un domaine nu, un CNAME y est impossible. Créer chez le registrar les enregistrements **A** vers les adresses que la console Clever affiche pour le domaine (ou un ALIAS/ANAME s'il en propose). Vérifier avec `clever domain diag --app <id web>`. Le certificat HTTPS est généré une fois le DNS en place. Pour que `www.promotional-sourcing.eu` réponde aussi, le rediriger vers le domaine nu chez le registrar.
4. Le staging utilise `ps-staging.cleverapps.io` : aucun DNS à configurer.

## 5. GitHub (manuel)

Dans Settings → Environments, créer `staging` et `production` :

| Élément                                        | Valeur                                                                |
| ---------------------------------------------- | --------------------------------------------------------------------- |
| Secret `CLEVER_TOKEN`, `CLEVER_SECRET`         | Ceux de l'utilisateur de CI (les mêmes dans les deux environnements)  |
| Variable `CLEVER_APP_WEB`, `CLEVER_APP_WORKER` | Identifiants `app_…` affichés par le script                           |
| Variable `APP_URL`                             | `https://<domaine>`, sans barre finale                                |
| `production` uniquement                        | « Required reviewers » ; déploiement limité à `main` et aux tags `v*` |

Puis, dans Settings → Secrets and variables → Actions → Variables du dépôt : `DEPLOY_STAGING=true`. Tant que cette variable est absente, `docker.yml` pousse l'image sur GHCR sans rien déployer.

## 6. Premier déploiement

1. Relancer le workflow **Docker** du dernier commit de `main` (ou merger une PR) : migrations, web, worker, puis `GET /health`.
2. Données de démonstration du staging : lancer les seeders une fois, depuis un poste, avec les variables de l'application.
3. Production : `git tag v0.1.0 && git push origin v0.1.0`, approuver le job `production`.
4. Essayer un rollback une fois (Actions → Release → Run workflow avec le tag précédent) : critère d'acceptation de #78.

## Ce qui n'a pas encore été vérifié en conditions réelles

Les scripts ont été testés à blanc et contre un faux `clever`, pas contre Clever Cloud. Au premier passage, surveiller :

- le tirage de l'image privée par Clever (`CC_DOCKER_LOGIN_*`) ;
- l'accès à la base depuis les runners GitHub pour les migrations ;
- les identifiants de plan PostgreSQL et le plan par défaut de Cellar ;
- la mémoire d'une instance XS pour le web (SSR) et le worker.
