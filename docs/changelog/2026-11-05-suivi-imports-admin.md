# Suivi des imports en masse (administration)

> Date : 2026-11-05

Issue #170 : l'équipe admin suit les imports lancés par les organisations (progression, erreurs ligne par ligne) et relance ceux qui ont échoué.

## Écrans et routes (droit `imports.manage`, admin seul)

Les erreurs d'import reprennent des valeurs saisies par les fournisseurs : nouveau droit `imports.manage`, porté par le seul rôle `admin` (403 pour les autres rôles plateforme, onglet masqué).

- `GET /:locale/admin/imports` (`admin.imports.index`, `ImportController`) : liste paginée (25), plus récent d'abord. Filtres : **statut**, **type** (`products_csv`, `suppliers_csv`), **organisation** (recherche partielle, jokers `%` et `_` cherchés tels quels).
- `GET /:locale/admin/imports/:id` (`admin.imports.show`) : résumé (organisation, auteur, progression, dates), lien vers l'import relancé ou remplacé, tableau des erreurs conservées (100 au plus ; `errorCount` donne le total réel).
- `POST /:locale/admin/imports/:id/retry` (`admin.imports.retry`) : relance. L'historique n'est pas réécrit : un **nouvel import** est créé (même organisation, même type, même fichier source, `retry_of_import_id` vers l'original) puis mis en queue (`RunImportJob`). Relançable : un import `failed`, ou resté `pending` / `running` **sans activité** depuis plus d'une heure (`updated_at`, rafraîchi à chaque ligne enregistrée : un import long mais vivant n'est pas relançable ; un import perdu est clos en échec avant d'être remplacé). Le nouvel import garde l'**auteur d'origine** (l'admin figure dans l'audit). Un import déjà relancé ne l'est pas deux fois. Audit `import.retried`.
- `GET /:locale/admin/imports/:id/errors` (`admin.imports.errors`) : CSV des erreurs conservées (`ligne;colonne;message;valeur_recue`, cellules protégées contre l'injection de formule). Audit `import.errors_exported`.

## Données

- Migration `1794000000005_alter_import_jobs_add_retry_of` : colonne `retry_of_import_id` (clé étrangère vers `import_jobs`, `SET NULL`, indexée) et index `(status, created_at)`.
- `database/schema.ts` : colonne `retryOfImportId` ajoutée à la main (à régénérer avec PostgreSQL).

## Traitement

`RunImportJob` appelle `ImportRunner`, qui n'utilise pas de modèle Lucid (les jobs sont chargés au boot de la queue). **Le moteur d'import (lecture du fichier, création des produits et fournisseurs) relève de #77** : tant qu'il n'est pas branché, un import relancé est clos en échec avec le motif « Aucun traitement n'est disponible pour ce type d'import ». Il n'est jamais laissé en attente. La fiche affiche un avertissement tant que `IMPORT_ENGINE_AVAILABLE` (`shared/types/admin_import.ts`) vaut `false` : à passer à `true` avec #77. Si la mise en queue échoue, l'import est clos en échec et reste relançable.

## Hors périmètre

Détail des lignes au-delà des 100 erreurs conservées, annulation d'un import en cours, notification du fournisseur à la fin de l'import.
