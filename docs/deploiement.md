# Déploiement

> Statut : **proposition**, à valider. Hébergement cible : Scaleway (#80). Issues liées : #78 (infra), #86 (releases par tag).

## Principe

- **Prod** : déploiement uniquement sur un tag `vX.Y.Z` (semver) poussé sur `main`.
- **Staging** (optionnel) : déploiement à chaque push sur `main`, sur un VPS séparé.
- **Une image par commit** : construite et testée une seule fois par la CI, taguée avec le SHA du commit. Le déploiement prod réutilise cette image, il ne rebuild jamais.

Un push sur `main` ne touche donc jamais la prod.

## Architecture (Scaleway)

| Élément | Rôle |
|---|---|
| Instance Scaleway (VPS) | Docker + Docker Compose |
| `app` (conteneur) | Serveur HTTP AdonisJS |
| `worker` (conteneur) | Queue AdonisJS, même image, autre commande |
| Reverse proxy (Caddy ou Traefik) | TLS et routage HTTP |
| Managed PostgreSQL | Base de données, hors Compose |
| Object Storage ou Cloudinary | Fichiers uploadés, jamais sur le disque du VPS |
| Container Registry | Stockage des images Docker |

## Cycle de vie d'une release

1. Développement sur une branche, PR vers `main`, revue, merge.
2. La CI sur `main` lance lint, typecheck et `pnpm test:db && pnpm test`, puis construit l'image `app:<sha>` et la pousse dans le registre.
3. (Optionnel) Déploiement staging automatique sur `main`, vérification manuelle.
4. Création du tag : `git tag v1.4.0 && git push origin v1.4.0`.
5. La CI sur le tag retrouve l'image `app:<sha>` correspondant au commit, la retague `app:v1.4.0`.
6. Le job `environment: production` attend l'approbation manuelle.
7. Sur approbation : connexion SSH au VPS, `docker compose pull`, migrations, puis `docker compose up -d`.

## Migrations

- Lancées avant le redémarrage de l'app, via un conteneur ponctuel : `docker compose run --rm app node ace migration:run --force`.
- Une migration déjà exécutée en production ne se modifie jamais (CLAUDE.md).
- Le `down()` n'est jamais lancé automatiquement. Un rollback de schéma est une opération manuelle, à décider au cas par cas.

## Rollback

Relancer le déploiement avec le tag précédent :

```bash
IMAGE_TAG=v1.3.2 docker compose up -d
```

Les anciennes images restent dans le registre. Si la release a inclus une migration destructive, le rollback applicatif ne suffit pas : il faut un plan de restauration de schéma ou de base.

## Secrets

- **GitHub Secrets** : clé SSH de déploiement, identifiants du registre, hôte du VPS.
- **`.env` sur le VPS** : variables de l'application, lues par Compose. Ce fichier n'est jamais committé.
- Clé SSH dédiée au déploiement, utilisateur `deploy` sans accès root par mot de passe.

## Sauvegardes

- Sauvegardes quotidiennes du Managed PostgreSQL, rétention à vérifier.
- Restauration testée au moins une fois avant la mise en production.
- Les fichiers uploadés sont sur Object Storage ou Cloudinary, sauvegardés selon leur fournisseur.

## Points à valider

- Noms exacts et tarifs des produits Scaleway (Container Registry, Object Storage), non vérifiés.
- Syntaxe du login au registre Scaleway, à confirmer dans leur documentation.
- Staging : séparé (coût d'un second VPS) ou absent.
- Approbation manuelle : activée sur l'environnement `production` GitHub.
