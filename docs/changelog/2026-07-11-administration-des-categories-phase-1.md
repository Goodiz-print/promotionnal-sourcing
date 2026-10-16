# Administration des catégories (CRUD taxonomie) — Phase 1

> Date : 2026-07-11

Ajoute l'écran d'administration de la taxonomie du catalogue : gestion complète
des catégories (arborescence `parentId`, contenu bilingue, synonymes). Clôt le
volet « gestion des catégories » de la Phase 1 (#19, issue de suivi de #2).

- **Routes** (`:locale`, `auth` + `onboarded`) :
  `admin.categories.index/create/store/edit/update/destroy`.
- **Ability** `canManageCategories` (owner/admin) + permission `categories:manage`
  (seeders `permission`/`role_permission`, accordée à owner et admin).
- **Service** `category_service.ts` : `listForAdmin` (parent + `withCount('products')`),
  `create`/`update` (traductions par locale), `delete`, garde-fous `hasChildren`/
  `hasProducts` (suppression bloquée) et `wouldCycle`/`assignableParents` (anti-cycle
  dans l'arbre).
- **Validateur** `category.ts` réécrit sur le modèle `*_translations` (contenu bilingue
  requis, slug unique non modifiable ensuite). **Transformers** `category_admin_transformer.ts`
  (liste localisée + compteur) et `category_edit_transformer.ts` (traductions des deux locales).
  **Types** `shared/types/category.ts` (`CategoryAdminType`, `CategoryEditType`, inputs).
  **Exception** `CategoryNotFoundException`.
- **Frontend** : pages `admin/categories/{index,create,edit}` + formulaire partagé
  `components/categories/form/category_form.vue` (parent, contenu bilingue, synonymes) ;
  i18n `resources/lang/{fr,en}/categories.json`.
- **Tests** : `tests/functional/admin_categories.spec.ts` (CRUD, ACL owner/membre/onboarding,
  slug unique, garde-fous suppression + cycle — SQLite), `tests/inertia/admin_categories.spec.ts`
  (liste + état vide).
