# Rôles plateforme fins pour le back-office

> Date : 2026-10-31

Issue #158 (epic #157). `users.platform_role` accepte désormais `moderator`, `support` et `analyst` en plus de `none` et `admin` (migration `alter_users_platform_role_add_fine_roles`, la contrainte `CHECK` est remplacée ; le `down()` ramène les rôles fins à `none`).

- **Droits** : chaque rôle est un ensemble de droits (`backoffice.access`, `organizations.view`, `users.view`, `catalogue.manage`, `roles.manage`, `audit.view`, `monitoring.view`), matrice dans `shared/types/user.ts`, détaillée dans `docs/admin.md`.
- **Autorisation** : nouvelle ability `hasPlatformPermission`. Le middleware `platformAdmin` n'exige plus que `backoffice.access` ; chaque contrôleur admin autorise le droit de sa section (organisations, utilisateurs, catégories, rôles, audit). `canManageCategories` repose sur `catalogue.manage` ; `isPlatformAdmin` reste réservée au rôle `admin`.
- **Menu** : l'entrée « Administration » apparaît pour tout rôle plateforme, et les onglets du back-office (`useAdminTabs`) sont filtrés par droit, avec un nouvel onglet « Journal d'audit ».
- **Gestion depuis l'interface** : colonne « Rôle plateforme » sur l'écran Utilisateurs avec un sélecteur (droit `roles.manage`) — `PATCH /admin/users/:id/platform-role` (`admin.users.platform_role.update`). Un admin ne peut pas modifier son propre rôle.
- `UserTransformer` expose `platformRole`. Factory : états `platformModerator`, `platformSupport`, `platformAnalyst`. `BaseSelect` gagne une prop `ariaLabel`.
- Tests : `tests/unit/platform_permissions.spec.ts`, `tests/functional/admin_roles.spec.ts`, `tests/inertia/admin_users.spec.ts`.
