# Référentiel de la production et admins plateforme

> Date : 2026-11-27

Aucune migration ne crée les données de référence : rôles, permissions, catégories, attributs, labels et techniques de marquage n'existaient que dans `MainSeeder`, mêlés aux données de démo. Une production qui ne passe que par les migrations n'avait donc pas de rôle `owner`, et la création d'organisation échouait. Détail : [`docs/deploiement.md` § Données de la production](../deploiement.md#données-de-la-production).

## Comportements notables

- **Nouveau `ReferenceSeeder`** : référentiel seul, sans compte, fiche ni produit. Il est lancé **à chaque déploiement** (staging et production) par `scripts/deploy/clever_migrate.sh`, après `migration:run` et `queue:migrate`. Idempotent et additif.
- **`MainSeeder` = `ReferenceSeeder` + démo.** Les catégories de démo (`crayon`, `stylo`, `sac`) passent dans un nouveau `DemoCategorySeeder` ; `CategorySeeder` ne garde que l'arbre du classeur Virgile. Le contenu semé en dev, en test et sur le staging ne change pas.
- **Workflow manuel « Admin plateforme »** (`.github/workflows/admin-grant.yml`) : `admin:grant` ou `admin:revoke` sur un compte déjà inscrit, en staging ou en production (approbation requise). L'e-mail est validé avant usage.
- **`scripts/deploy/deployed_image.sh`** : image servie par un environnement (version de `GET /health`, `/` final de `APP_URL` toléré). Partagé par « Seed staging » et « Admin plateforme ».
- **Test** : `tests/functional/reference_seeder.spec.ts`. Il vérifie le rôle `owner` et ses permissions, l'arbre des catégories avec ses parents, l'absence de toute donnée de démo, et l'idempotence.
