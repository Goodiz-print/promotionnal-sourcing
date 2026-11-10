# ADR 0005 : environnements et déploiement sur Clever Cloud

- **Statut** : accepté
- **Date** : 2026-11-10
- **Issues liées** : #78 (déploiement, CI/CD, sauvegardes)
- **Complète** : [ADR 0003](0003-hebergement-clever-cloud.md) (hébergement) et [ADR 0004](0004-maintien-meilisearch-hebergement.md) (Meilisearch)

## Contexte

L'ADR 0003 retient Clever Cloud et `docs/deploiement.md` fixe les règles : staging sur push `main`, production sur tag `vX.Y.Z` après approbation, une image par commit réutilisée sans reconstruction. Rien n'était implémenté.

La documentation Docker de Clever Cloud impose trois contraintes que ces règles ignoraient :

1. **Pas de déploiement d'image.** Une application Docker reconstruit le `Dockerfile` qu'on lui pousse par git. `clever deploy --tag vX.Y.Z` pousserait le dépôt et reconstruirait tout : la production ne tournerait pas sur l'image testée. La voie documentée pour une image pré-construite est un `Dockerfile` dont le `FROM` désigne l'image du registre, avec `CC_DOCKER_LOGIN_*` pour un registre privé.
2. **Un conteneur doit écouter en HTTP** sur le port 8080 et sa commande ne se surcharge pas au lancement. Les « workers » de la plateforme ne s'appliquent pas à Docker.
3. **Ni volume persistant, ni hook avant démarrage.** Seul `CC_RUN_SUCCEEDED_HOOK` existe en Docker, après le démarrage.

## Décision

### Construire une fois, promouvoir par un Dockerfile d'une ligne

La CI construit l'image une fois par commit de `main` et la pousse sur GHCR, taguée au SHA. Déployer une application revient à pousser sur son dépôt git Clever un commit généré, dont le seul fichier est :

```dockerfile
FROM ghcr.io/goodiz-print/promotionnal-sourcing@sha256:<digest>
```

Le worker ajoute `CMD ["node", "ace", "queue:serve"]`. Staging et production exécutent le même binaire, identifié par son digest. Script : `scripts/deploy/clever_push.sh`.

### Trois environnements

|                      | Production                      | Staging                       | Review                                         |
| -------------------- | ------------------------------- | ----------------------------- | ---------------------------------------------- |
| Organisation Clever  | `goodiz-prod`                   | `goodiz-nonprod`              | `goodiz-nonprod`                               |
| Applications         | web ×2, worker                  | web ×1, worker                | un conteneur web + worker                      |
| Déclencheur          | tag `vX.Y.Z` + approbation      | push `main` après CI verte    | label `review` sur la PR                       |
| Environnement GitHub | `production` (relecteur requis) | `staging`                     | `review`                                       |
| Données              | réelles                         | seeders, mails en bac à sable | seeders, base jetable, détruite à la fermeture |

Deux organisations Clever : le jeton utilisé par les workflows de PR et de staging n'a aucun droit sur la production.

Les reviews sont créées **sur label** et non sur chaque PR : le dépôt reçoit plusieurs PR par jour, la plupart n'ont pas besoin d'une démonstration. Leur mise en œuvre fait l'objet d'une livraison séparée (voir « Points ouverts »).

### Migrations par la CI, avant le déploiement

Clever Cloud n'offre aucun hook avant démarrage en Docker. La CI lance donc l'image à déployer avec `node ace migration:run --force` puis `node ace queue:migrate`, avant tout redémarrage. Ordre : migrations, web, worker. Un échec arrête la release et laisse la version en place intacte.

Les variables nécessaires sont lues sur l'application web Clever au moment de l'exécution (`scripts/deploy/clever_migrate.sh`) : aucun identifiant de base n'est stocké dans GitHub, seuls le sont le jeton et le secret Clever de l'environnement.

### Sonde HTTP du worker

`node ace queue:serve` lance `queue:work` et répond 200 sur `GET /health` (port `PORT`). C'est une sonde de vie : elle ne regarde ni la base ni le backlog, pour qu'un retard de la queue ne fasse pas échouer un déploiement. `node ace queue:health` reste la sonde métier.

### Infrastructure créée par script

`scripts/deploy/clever_provision.sh <environnement>` crée applications, add-ons, liens, tailles et variables non secrètes à partir de `scripts/deploy/environments/<environnement>.env`. Il est idempotent et ne manipule aucun secret du dépôt.

## Alternatives écartées

| Option                                                                   | Raison du rejet                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Laisser Clever construire le dépôt (`clever deploy`, intégration GitHub) | Une construction par application et par environnement : la production ne tourne pas sur le binaire testé en staging. Le worker exigerait un second Dockerfile complet. Le déploiement ne dépendrait plus de la CI.                                                                       |
| Migrations au démarrage du conteneur web                                 | Une migration lente retarde chaque démarrage et chaque montée en charge ; un échec survient pendant le déploiement, pas avant.                                                                                                                                                           |
| Terraform (provider `CleverCloud/clevercloud`)                           | État à héberger et à protéger (il contient les secrets des applications), provider 3.x récent avec changements cassants, aucun apport sur les déploiements ni sur les reviews. Réversible : `clever terraform generate --org` génère la configuration depuis une organisation existante. |
| Une review par PR                                                        | Une application et une base par PR pour un dépôt à plusieurs PR par jour.                                                                                                                                                                                                                |

## Conséquences

**Positives**

- La production exécute exactement l'image validée en staging. Un rollback redéploie le digest d'une version antérieure, sans reconstruction.
- Staging et production sont décrits par deux fichiers de paramètres relus en PR.
- GitHub ne détient aucun identifiant de base de données.

**Négatives**

- Les applications Clever doivent pouvoir tirer l'image sur GHCR : un jeton `read:packages` est posé sur chacune (`CC_DOCKER_LOGIN_PASSWORD`), à renouveler à son expiration.
- La base doit accepter les connexions des runners GitHub pour les migrations.
- Le déploiement passe par un dépôt git jetable : l'historique des déploiements se lit dans GitHub Actions et dans l'activité Clever, pas dans git.
- Un changement de variable par `clever_provision.sh` ne s'applique qu'au redémarrage suivant de l'application.

## Points ouverts

1. **Extensions PostgreSQL sur un add-on créé à la volée** (`vector`, `pg_trgm`, `unaccent`). Si le support doit intervenir à chaque add-on, les reviews partageront une seule base, avec un schéma par PR. À trancher avant la livraison des reviews.
2. **Meilisearch** : l'absence de volume persistant sur Docker Clever est documentée. Une instance Docker y perdrait son index et son modèle à chaque redémarrage, et la réindexation recalcule tous les vecteurs (`docs/search.md`). Meilisearch Cloud devient l'option par défaut (ADR 0004), en production comme en staging ; en attendant, un environnement sans `MEILISEARCH_HOST` fonctionne sur la recherche PostgreSQL.
3. **Identifiants des plans PostgreSQL** dans `environments/*.env` et mémoire d'une instance XS pour le web SSR : à vérifier au premier provisioning.

## Critères de révision

- Clever Cloud propose le déploiement direct d'une image de registre.
- L'infrastructure dépasse ce qu'un script relit facilement (plus de trois environnements, plusieurs régions) : passer à Terraform.
