# Journal d'audit des actions du back-office

> Date : 2026-10-31

Issue #159 (epic #157). Toute action d'écriture du back-office est inscrite dans la table `admin_audit_logs` (migration `create_admin_audit_logs_table`), en ajout seul : acteur (id + instantané de l'email), action, cible, valeurs avant/après (`jsonb`), IP, date.

- **Service** : `AdminAuditService.record` écrit l'entrée dans la **même transaction** que l'action tracée ; `list` pagine avec filtres. Le contrôleur construit le contexte via `adminActionContext(ctx)`.
- **Actions tracées** : `platform_role.changed` (écran Utilisateurs, et commandes `admin:grant` / `admin:revoke` avec `source: 'cli'` et sans acteur), `category.created`, `category.updated`, `category.deleted`, et les six actions `attribute.*` / `attribute_value.*` (facettes du catalogue, #48). `AttributeService` écrit chaque modification et son entrée d'audit dans une même transaction ; ses méthodes d'écriture prennent un `AdminActionContext`. `CategoryService` écrit désormais ses données dans une transaction et met la traduction automatique en file après le commit.
- **Écran** : `GET /admin/audit` (`admin.audit.index`, droit `audit.view`, admin uniquement) — 50 entrées par page, filtres `action`, `targetType`, `actor`, `from`, `to`.
- `PlatformAdminService` s'obtient par injection (`@inject`) et non plus par `new`.
- Tests : `tests/functional/admin_audit.spec.ts`, `tests/functional/admin_roles.spec.ts`, `tests/inertia/admin_audit.spec.ts`. Factory : `AdminAuditLogFactory`.
