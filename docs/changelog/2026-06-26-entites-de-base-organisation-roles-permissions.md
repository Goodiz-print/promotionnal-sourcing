# Entités de base : Organisation, Rôles, Permissions

> Date : 2026-06-26

Création du socle multi-tenant : organisations (entreprises françaises), rôles système et permissions granulaires.

- **Tables créées** :
  - `organizations` — entreprise avec champs B2B FR (SIRET, TVA, secteur, taille, adresse)
  - `roles` — 4 rôles système : `owner`, `admin`, `manager`, `member`
  - `permissions` — 8 permissions granulaires : `organization:manage`, `members:invite`, `members:manage`, `roles:assign`, `sourcing:create`, `sourcing:manage`, `sourcing:view`, `billing:manage`
  - `role_permissions` — pivot rôle ↔ permission (clé primaire composite, sans timestamps)
  - `organization_users` — pivot enrichi user ↔ organisation avec `role_id` et `joined_at`
- **Colonne ajoutée** : `users.current_organization_id` (FK nullable → organizations, SET NULL on delete)
- **Modèles** :
  - `app/models/organization.ts` — hasMany OrganizationUser, manyToMany User
  - `app/models/role.ts` — manyToMany Permission, hasMany OrganizationUser
  - `app/models/permission.ts` — manyToMany Role
  - `app/models/organization_user.ts` — belongsTo Organization, User, Role (modèle dédié pour preload Bouncer)
  - `app/models/user.ts` — ajout des relations organizations, organizationUsers, currentOrganization
- **Seeders** (`database/seeders/`) :
  - `role_seeder.ts`, `permission_seeder.ts`, `role_permission_seeder.ts` — idempotents via `updateOrCreateMany` / `sync()`
- **Types partagés** (`shared/types/`) :
  - `role.ts` — `RoleSlug`, `RoleType`, `PermissionType`, `RoleWithPermissionsType`
  - `organization.ts` — `OrganizationSize`, `OrganizationType`, `OrganizationMemberType`, `CreateOrganizationData`
- **Abilities Bouncer** (`app/abilities/main.ts`) :
  - `canManageOrganization` — owner ou admin
  - `canInviteMembers` — owner, admin ou manager
  - `canManageMembers` — owner ou admin
- **Validators** (`app/validators/organization.ts`) : `createOrganizationValidator` (slug unique + regex kebab-case, SIRET 14 chiffres, CP 5 chiffres), `updateOrganizationValidator` (sans slug)
- **Transformers** : `organization_transformer.ts`, `role_transformer.ts`
- **Comportement notable** :
  - Un utilisateur peut appartenir à plusieurs organisations ; `current_organization_id` stocke le contexte actif
  - Le slug d'une organisation ne peut pas être modifié via `updateOrganizationValidator` (risque de casser les URLs)
  - RESTRICT sur `role_id` dans `organization_users` — suppression d'un rôle bloquée si des membres l'utilisent
