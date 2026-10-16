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
