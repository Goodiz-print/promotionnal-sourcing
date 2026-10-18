# Stockage des fichiers — Cellar (Clever Cloud, API S3)

Les fichiers (galerie produit, logos d'organisation…) sont stockés sur **Cellar**,
l'objet storage S3 de Clever Cloud. Cloudinary est retiré (on repart de zéro :
pas de reprise des assets existants).

## Configuration

| Variable                   | Rôle                                                       |
| -------------------------- | ---------------------------------------------------------- |
| `CELLAR_ENDPOINT`          | Hôte (`CELLAR_ADDON_HOST`) ou URL complète du Cellar       |
| `CELLAR_BUCKET`            | Bucket (à créer au préalable, ex. via `s3cmd`/`aws s3 mb`) |
| `CELLAR_ACCESS_KEY_ID`     | `CELLAR_ADDON_KEY_ID` de l'add-on                          |
| `CELLAR_SECRET_ACCESS_KEY` | `CELLAR_ADDON_KEY_SECRET` de l'add-on (secret)             |

Validées dans `start/env.ts`, lues par `config/storage.ts`, documentées dans
`.env.example`. Les tests utilisent des valeurs factices (`.env.test`, CI) : le
driver y est remplacé par un faux.

**Déploiement (Clever Cloud)** : lier l'add-on Cellar à l'application expose
`CELLAR_ADDON_*` ; les mapper vers les 4 variables ci-dessus. Les objets sont
écrits en `public-read` et servis en _path-style_ :
`<endpoint>/<bucket>/<clé>`. Le worker de la queue (`node ace queue:work`) doit
tourner : il exécute la purge et la reprise.

## Développement local (S3Mock)

`docker compose up -d` démarre **S3Mock** (`adobe/s3mock`, S3 local sur
`localhost:9090`), qui crée au démarrage le bucket `promotionnal-sourcing-dev`.
Il n'impose ni authentification ni ACL : les objets sont lisibles
publiquement, comme sur le bucket Cellar. Les valeurs de `.env.example` pointent
dessus (`CELLAR_ACCESS_KEY_ID`/`SECRET` ne sont pas vérifiés, mais requis) :
les copier dans `.env` suffit, le code est identique à la production (même
driver, même parcours d'upload). Les fichiers sont conservés dans le volume
`promotionnal-sourcing_s3_data`. URLs :
`http://localhost:9090/promotionnal-sourcing-dev/<clé>`. `pnpm dev:all` lance tout l'environnement de dev, worker de la queue
compris (nécessaire pour exécuter les purges).

## Architecture

- `StorageDriver` (`app/services/storage/storage_driver.ts`) — classe abstraite,
  token d'injection ; `CellarStorageDriver` est l'implémentation (SDK
  `@aws-sdk/client-s3`), liée dans `providers/storage_provider.ts`.
- `StorageService` — envoi idempotent (`store`, `storeMany`), libération d'une
  référence (`release`), purge différée (`dispatchDeletions`), rattrapage d'un
  échec métier (`discard`).
- `StorageCleanupService` — travail des jobs (`purgeDeleted`, `recoverStale`).
- Jobs : `DeleteStorageObjectJob` (purge d'un `pending_delete`),
  `RecoverStorageUploadsJob` (reprise, planifiée toutes les heures).

## Clé déterministe

`promotionnal-sourcing/<NODE_ENV>/<sha256>.<ext>`. Aucun nom aléatoire : un uuid
par tentative casserait la déduplication (le même fichier envoyé deux fois
donnerait deux objets).

## Table `storage_objects`

`id`, `key`, `checksum` (sha256), `mime_type`, `size`, `status`
(`pending_upload` | `ready` | `pending_delete`), `created_at`, `updated_at`.

`key` est unique **hors `pending_delete`** (index partiel) : une pierre tombale
porte la clé d'un objet qui peut être re-téléversé avant la purge ; les deux
lignes doivent coexister.

Les références métier sont des FK vers cette table : `product_images.storage_object_id`
et `organizations.logo_storage_object_id` (`ON DELETE RESTRICT`). Toute nouvelle
référence s'ajoute à `STORAGE_REFERENCES` (`shared/types/storage.ts`).

## Séquence d'envoi (`StorageService.store`)

1. Une ligne `ready` existe pour la clé → réutilisée, **rien n'est envoyé**.
2. Sinon : transaction courte qui pose `pending_upload` (sous verrou
   consultatif sur la clé), envoi, puis passage à `ready`.
3. Échec : suppression de la ligne **et** de l'objet s'il existe, sauf si une
   autre ligne vivante porte la même clé. Si ce nettoyage échoue, la reprise
   s'en charge.

Un envoi identique concurrent (ligne `pending_upload` de moins de 10 min) lève
`StorageUploadInProgressException` (409) ; une ligne plus ancienne est reprise.

## Remplacement / suppression d'une référence

Dans la **même transaction** que la mise à jour de la référence,
`StorageService.release` : si plus rien ne désigne l'objet, remplace sa ligne
`ready` par une ligne `pending_delete` (même clé). Après le commit,
`dispatchDeletions` met en queue `DeleteStorageObjectJob`.

- Le job supprime l'objet **seulement** si aucune ligne `ready` (ou
  `pending_upload`) ne porte la même clé, puis supprime la ligne. Supprimer un
  objet absent est un succès.
- Objet encore référencé ailleurs (dédoublonnage) → aucune pierre tombale.
- Si la transaction métier échoue, rien n'est écrit ; le nouvel objet tout juste
  stocké est libéré par `discard`.

## Variantes d'image (miniatures)

Cellar ne redimensionne rien à la volée (aucun service d'image côté Clever
Cloud) : les variantes sont générées **à l'upload**, avec `sharp`.

- Après le rattachement d'une image à un produit, `SupplierProductService`
  dispatche `GenerateImageVariantsJob` (un par image, hors transaction). Le job
  résout `ImageVariantService` dans `execute()` (le service importe des modèles
  Lucid — règle DI de `CLAUDE.md`).
- Variantes (`IMAGE_VARIANTS`, `shared/types/image_variant.ts`) : `card` 400 px,
  `detail` 800 px, `zoom` 1600 px de large maximum, en **WebP** (qualité 80),
  orientation EXIF appliquée, **jamais agrandies**.
- Chaque variante est un objet `storage_objects` écrit par
  `StorageService.storeContent` (clé déterministe, dédoublonnage, zéro orphelin)
  et référencé par `product_image_variants` (`storage_object_id`, `ON DELETE
RESTRICT`, ajouté à `STORAGE_REFERENCES`). La ligne variante part en cascade
  avec son image : retirer une image ou supprimer un produit libère donc
  l'original **et** ses variantes dans la même transaction.
- Idempotent : une variante déjà présente n'est pas régénérée, un job rejoué
  reprend où il s'est arrêté. Le job lit l'original via `StorageDriver.get`.
- **Repli** : si la génération échoue (fichier illisible, Cellar indisponible),
  3 tentatives puis erreur loggée ; le produit est déjà enregistré et le
  frontend sert l'original (`url`) tant qu'une variante manque.
- Le job renseigne aussi `product_images.width`/`height` (jusque-là jamais
  remplis).

## Reprise (`RecoverStorageUploadsJob`)

Toutes les heures : supprime les `pending_upload` de plus de 24 h (objet s'il
existe, puis ligne) et rejoue les `pending_delete` de plus de 24 h dont le job
de purge s'est perdu. Ne touche **jamais** une ligne `ready`.

## Tests

`tests/functional/storage.spec.ts`. Le client Cellar est remplacé par
`FakeStorageDriver` (`tests/utils/storage.ts`) via
`container.swap(StorageDriver, …)` (`useFakeStorage(group)`).

## Documents PDF (#60)

- **Tables** : `organization_documents` (catalogue, certificat, autre) et `product_documents` (fiche technique). Toutes deux référencent `storage_objects` et figurent dans `STORAGE_REFERENCES`.
- **Flux** : `DocumentService.addTo…` lit le PDF, le compresse via `PdfService`, puis le stocke par `StorageService.storeContent` (clé déterministe, `application/pdf`).
- **Compression** : `gs -sDEVICE=pdfwrite -dPDFSETTINGS=/ebook`, derrière la classe abstraite `GhostscriptRunner`. Si `gs` est absent, échoue ou n'allège pas le fichier : PDF original, warning loggé.
- **Retrait** : `removeOrganizationDocument` / `removeProductDocument` suppriment la ligne et libèrent le fichier dans la même transaction, puis planifient la purge.
- **Routes** (groupe authentifié et `onboarded`, `start/routes/documents.ts`) :
  - `POST /fr/supplier/profile/documents` (champs `kind`, `file`) et `DELETE /fr/supplier/profile/documents/:id` — droits `canManageSupplierProfile`.
  - `POST /fr/supplier/products/:id/documents` (champ `file`) et `DELETE /fr/supplier/products/:id/documents/:documentId` — droits `canManageProducts`.
- **Validation** : PDF uniquement, 20 Mo maximum (`app/validators/document.ts`), et en-tête `%PDF-` vérifié au contenu.
- **Non couvert** : interfaces (profil, annuaire public, formulaire produit).
