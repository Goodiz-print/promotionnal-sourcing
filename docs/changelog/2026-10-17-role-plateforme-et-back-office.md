# Rôle plateforme (super-admin) et back-office minimal

> Date : 2026-10-17

Il n'existait aucun rôle au niveau plateforme : `canManageCategories` autorisait le `owner`/`admin` de **n'importe quelle organisation** à créer, modifier et supprimer les catégories globales du catalogue. Corrigé, et premier socle d'un back-office réservé à l'équipe (#47).

- **Rôle plateforme** : colonne `users.platform_role` enum(`none`, `admin`, défaut `none`) — migration `alter_users_add_platform_role` (avec `down()`), `User.platformRole` / `User.isPlatformAdmin`, types dans `shared/types/user.ts`.
- **Autorisation** : ability `isPlatformAdmin` ; `canManageCategories` en dépend et ne prend plus d'organisation. Middleware nommé `platformAdmin` sur le groupe `/:locale/admin/**` (après `auth` et `emailVerified`, hors `onboarded`) : anonyme → connexion, utilisateur sans rôle plateforme → 403.
- **Attribution** : commandes `node ace admin:grant <email>` et `node ace admin:revoke <email>` (injection de méthode, `PlatformAdminService` idempotent) ; `DevUserSeeder` crée l'admin de démo `admin@promotionnal-sourcing.test` (sans organisation), le compte de démo existant reste ordinaire.
- **Back-office** : `GET /admin` (compteurs organisations / utilisateurs / produits / RFQ), `GET /admin/organizations` (filtres type et archivage, pagination), `GET /admin/organizations/:id` (fiche + membres), `GET /admin/users` (recherche par email, pagination). Navigation dédiée `admin_nav`, composant générique `base_pagination`, textes dans `resources/lang/{fr,en}/admin.json` (repli anglais pour les autres langues), entrée « Administration » du menu visible uniquement pour les admins plateforme (`user.isPlatformAdmin` partagé).
- **Taxonomie** : les écrans `/admin/categories/**` passent sous le même middleware ; ils ne dépendent plus de l'organisation courante.
- **Tests** : `tests/functional/admin_platform_role.spec.ts`, `admin_dashboard.spec.ts`, `admin_organizations.spec.ts`, `admin_users.spec.ts` ; `admin_categories.spec.ts` et `translation_policy.spec.ts` adaptés (non-régression : un owner d'organisation reçoit un 403) ; `tests/inertia/admin_users.spec.ts` ; état de factory `platformAdmin`.
- **Déploiement** : après migration, créer le premier admin avec `node ace admin:grant <email>`. Tant que ce n'est pas fait, plus personne ne peut gérer les catégories.
