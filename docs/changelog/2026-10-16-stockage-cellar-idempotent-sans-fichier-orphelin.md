# Stockage Cellar idempotent, sans fichier orphelin (remplace Cloudinary)

> Date : 2026-10-16

Les fichiers (galerie produit, logos) sont désormais stockés sur **Cellar**
(Clever Cloud, API S3) au lieu de Cloudinary, avec des envois idempotents et la
garantie qu'aucun objet n'est laissé sans référence. Détail : `docs/storage.md`.

- **Config** — `config/storage.ts` ; variables `CELLAR_ENDPOINT`, `CELLAR_BUCKET`,
  `CELLAR_ACCESS_KEY_ID`, `CELLAR_SECRET_ACCESS_KEY` validées dans `start/env.ts`
  et documentées dans `.env.example` (valeurs factices dans `.env.test` et la CI).
  Dépendance `@aws-sdk/client-s3` ajoutée, `cloudinary` retirée.
- **Abstraction** — `StorageDriver` (classe abstraite, token d'injection) liée à
  `CellarStorageDriver` par `providers/storage_provider.ts`. Services, config,
  exception (`upload_errors.ts`) et spec Cloudinary supprimés.
- **Table `storage_objects`** (migration `…972`) — `key`, `checksum` sha256,
  `mime_type`, `size`, `status` (`pending_upload` | `ready` | `pending_delete`).
  `key` est unique **hors `pending_delete`** (index partiel) pour qu'une pierre
  tombale cohabite avec un objet re-téléversé à l'identique.
- **Références** (migration `…973`) — `product_images.public_id` →
  `storage_object_id` ; `organizations.logo_public_id` →
  `logo_storage_object_id` (FK `ON DELETE RESTRICT`, nullable : les lignes
  Cloudinary historiques n'ont pas d'objet Cellar, on repart de zéro).
- **Clé déterministe** — `promotionnal-sourcing/<NODE_ENV>/<sha256>.<ext>`, jamais
  de nom aléatoire (sinon pas de dédoublonnage).
- **Envoi** (`StorageService.store`) — ligne `ready` existante réutilisée sans
  rien envoyer ; sinon `pending_upload` en transaction, envoi, puis `ready` ; en
  cas d'échec, ligne et objet supprimés. Un envoi identique concurrent récent
  renvoie une 409 (`E_STORAGE_UPLOAD_IN_PROGRESS`).
- **Remplacement / suppression** — `StorageService.release` écrit la ligne
  `pending_delete` de l'ancienne clé **dans la transaction** qui met la référence
  à jour (logo, galerie, suppression de produit) ; la purge est mise en queue après
  le commit. Un objet encore référencé ailleurs n'est jamais libéré.
- **Jobs** — `DeleteStorageObjectJob` (supprime l'objet seulement s'il n'est plus
  porté par une ligne `ready`, puis la ligne ; objet absent = succès) et
  `RecoverStorageUploadsJob` (planifié toutes les heures : `pending_upload` de plus
  de 24 h, plus les `pending_delete` de plus de 24 h dont le job s'est perdu ; ne
  touche jamais une ligne `ready`).
- **Dev local** — service S3Mock (S3) dans `docker-compose.yml`, bucket public
  `promotionnal-sourcing-dev` créé au démarrage ; valeurs par défaut dans
  `.env.example`. Voir `docs/storage.md`.
- **Tests** — `tests/functional/storage.spec.ts` (faux client via
  `container.swap(StorageDriver, …)`), specs galerie / logo adaptées.
- Aucune route ni champ de formulaire ne change ; seul le stockage derrière
  l'upload du logo et de la galerie produit est remplacé.
