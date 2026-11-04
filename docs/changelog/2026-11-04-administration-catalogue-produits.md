# Administration du catalogue produits

> Date : 2026-11-04

Issue #164 (epic #157) : back-office de gestion des produits du catalogue.

## Routes

- `GET /admin/products` (`admin.products.index`) : liste paginée des produits avec filtres.
- `GET /admin/products/:id` (`admin.products.show`) : fiche détaillée d'un produit.
- `POST /admin/products/:id/hide` : masque un produit (modération rejected, motif obligatoire).
- `POST /admin/products/:id/unhide` : révèle un produit masqué (modération approved).
- `POST /admin/products/:id/unpublish` : dépublie un produit (is_active=false).
- `POST /admin/products/:id/publish` : publie un produit (is_active=true).
- `POST /admin/products/:id/archive` : archive un produit (lifecycle_status=retired, is_active=false).
- `POST /admin/products/:id/restore` : restaure un produit archivé (lifecycle_status=active).
- `POST /admin/products/:id/reindex` : demande une réindexation.

## Droits

- `products.view` (admin, moderator, support) : consultation de la liste et des fiches.
- `products.manage` (admin seul) : exécution des actions.

## Filtres de liste

- `search` : nom traduit, slug, SKU de variante ou nom d'organisation fournisseur.
- `supplierId` : ID de l'organisation fournisseur.
- `categoryId` : inclut les sous-catégories.
- `visibility` : published, unpublished, hidden, archived.
- `quality` : no_image, no_translation, no_variant.

## Comportement des actions

- Chaque action est auditée dans la même transaction (journal d'audit).
- Idempotence : une action sans changement effectif renvoie 409 sans trace d'audit.
- hide/unhide réutilise `ModerationService.decide` (réindexation after-commit automatique).
- Les autres actions émettent `ProductChanged` after-commit pour la réindexation.
- Le verrou `FOR UPDATE` garantit la cohérence entre actions concurrentes.

## Fichiers

- Types : `shared/types/admin_product.ts`
- Services : `app/services/admin_product_service.ts`, `app/services/admin_product_action_service.ts`
- Controllers : `app/controllers/admin/product_controller.ts`, `app/controllers/admin/product_management_controller.ts`
- Validators : `app/validators/admin_product.ts`
- Transformers : `app/transformers/admin_product_transformer.ts`, `app/transformers/admin_product_detail_transformer.ts`
- Exceptions : `app/exceptions/admin_product_errors.ts`
- Tests : `tests/functional/admin_products.spec.ts`
