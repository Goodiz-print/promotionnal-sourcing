# ADR 0003 : hébergement sur Clever Cloud

- **Statut** : accepté
- **Date** : 2026-10-23
- **Issues liées** : #80 (choix de l'hébergement, clos), #78 (déploiement, CI/CD, sauvegardes), #112 (Meilisearch)

## Contexte

L'application est portée par une seule personne. Elle comprend une application web, un worker de queue, une base PostgreSQL avec pgvector, un stockage objet pour les images et PDF, et un moteur de recherche Meilisearch. Il faut un staging et une production.

La base doit fournir pgvector, pg_trgm et unaccent, des sauvegardes quotidiennes, et une restauration à un instant donné en option. Le budget d'infrastructure est de 100 à 500 € par mois (ADR 0001).

Deux options ont été comparées :

- **Clever Cloud** : PaaS, PostgreSQL managé, Cellar (S3) et instances Docker, sur la même facturation.
- **Scaleway** : instances, PostgreSQL managé et Object Storage. Les serveurs (applications, Meilisearch) sont administrés par nos soins sur des VPS Docker Compose.

## Décision

**Clever Cloud est retenu pour les deux environnements (staging et production).**

Composants :

| Composant            | Instance Clever Cloud (prod)         | Remarque                                                             |
| -------------------- | ------------------------------------ | -------------------------------------------------------------------- |
| Application web (×2) | Docker XS                            | Image Docker du `Dockerfile` racine                                  |
| Worker de queue      | Docker XS                            | Même image, commande `node ace queue:work`                           |
| PostgreSQL 18        | S Big Space (2 vCPU, 2 Go, 20 Go)    | pgvector, pg_trgm, unaccent à activer via le support                 |
| Cellar               | Stockage et trafic à la consommation | Bucket dédié par environnement                                       |
| Meilisearch          | Docker M (4 vCPU, 4 Go)              | Image `getmeili/meilisearch` épinglée, volume persistant à confirmer |

Coût de la production (devis commercial, par mois) : **176,50 € HT, soit 211,80 € TTC**, avec 50 Go de trafic sortant Cellar. Les frais de réplication sont exclus. Le staging n'est pas encore chiffré.

## Alternatives écartées

| Option                                             | Raison du rejet                                                                                                                                                                                                                     |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scaleway (VPS Docker Compose et PostgreSQL managé) | Coût direct comparable (≈ 195 € HT/mois), mais environ 60 à 100 h de plus par an en administration système : correctifs, Docker, certificats, snapshots Meilisearch, supervision. Charge difficile à tenir pour une personne seule. |

## Conséquences

**Positives**

- Pas de serveur à administrer : mises à jour, sauvegardes quotidiennes et certificats sont gérés par la plateforme.
- Un seul fournisseur pour l'applicatif, la base et le stockage.
- Déploiement possible par tag Git (`clever deploy --tag`), donc les versions en production sont explicites.

**Négatives**

- Coût direct plus élevé que Scaleway pour une configuration équivalente.
- Dépendance à Clever Cloud pour les extensions PostgreSQL (activation par le support) et pour le stockage persistant de Meilisearch sur instance Docker.
- Tarif du trafic sortant Cellar à confirmer au-delà de la franchise.

## Points à valider avant mise en production

1. Activation de pgvector, pg_trgm et unaccent par le support Clever Cloud.
2. Volume persistant sur une instance Docker, pour Meilisearch.
3. Déploiement d'une image Docker (et non d'un runtime Node) pour les applications web et worker, nécessaire à Ghostscript et aux dictionnaires hunspell.
4. Dimensionnement de PostgreSQL et de Meilisearch après test de charge (le 20 Go de la base est jugé insuffisant à terme avec un million de produits).

## Critères de révision

- Coût mensuel supérieur à 500 € HT (plafond d'ADR 0001).
- Impossibilité de faire tourner Meilisearch ou pgvector sur Clever Cloud.
- Volumétrie de la base qui impose une réplication coûteuse.
