# Gestion des membres de l'organisation (PR 2/3 gestion des organisations)

> Date : 2026-07-17

Deuxième volet de la gestion des organisations : un écran permet aux
owner/admin de lister les membres de leur **organisation courante**, de
changer leur rôle et de les retirer. **Pas d'invitation par email** dans ce
PR (prévue au PR 3).

- **Exceptions** `app/exceptions/organization_errors.ts` : `LastOwnerException`
  (422) et `OrganizationMemberNotFoundException` (404).
- **Validator** `app/validators/organization_member.ts` : `updateMemberRoleValidator`
  (`roleId: number positive`).
- **Transformer** `app/transformers/organization_member_transformer.ts` :
  `OrganizationUser` (préchargé `user`+`role`) → `OrganizationMemberType`.
  `RoleTransformer` corrigé (retour typé `RoleType`, `slug` casté en
  `RoleSlug` — jusqu'ici non branché, jamais vérifié par le typage).
- **Service** `app/services/organization_members_service.ts` : `listMembers`,
  `findMember` (404 si hors organisation), `changeRole`, `removeMember`. Garde
  métier centrale : **une organisation garde toujours au moins un owner** —
  `changeRole`/`removeMember` rejettent (`LastOwnerException`) toute
  rétrogradation/retrait du dernier `owner`. Un membre retiré dont
  l'organisation courante était celle-ci se voit réinitialiser
  `currentOrganizationId` (repasse par l'onboarding).
- **Controller** `app/controllers/organization/members_controller.ts` :
  `index`/`update`/`destroy`, ability `canManageMembers` (déjà écrite en
  Phase 2, jamais branchée). `LastOwnerException` interceptée dans le
  controller → flash `error` + redirection (pas de page d'erreur générique).
- **Routes** : `GET organization/members`, `PATCH organization/members/:id`,
  `DELETE organization/members/:id` — dans le groupe `onboarded` existant.
- **Types** (`shared/types/role.ts`, `shared/types/organization.ts`) :
  `RoleType`/`PermissionType`/`RoleWithPermissionsType`/`OrganizationMemberType`
  passés d'`interface` à `type` (contrainte props Inertia — la conversion
  s'applique aussi aux types **nichés** dans un DTO, pas seulement au niveau
  racine, cf. `OrganizationMemberType.role: RoleType`).
- **Écran** `inertia/pages/organization/members.vue` : tableau membres +
  `<select>` de rôle par ligne (mutation ponctuelle `router.patch`,
  `preserveScroll`) + retrait (`window.confirm` + `router.delete`, pattern
  repris de `admin/categories/index.vue`/`supplier/products/index.vue`).
  Nouveau composant partagé `inertia/components/organization/section_nav.vue`
  (onglets Paramètres/Membres) inclus sur `organization/settings.vue` et
  `organization/members.vue`.
- **i18n** `resources/lang/{fr,en}/organization.json` étendu (`members.*`,
  `nav.*`).
- **Tests** : `tests/functional/organization_members.spec.ts` (8 tests,
  SQLite **et** Postgres — aucune fonctionnalité catalogue requise, pattern
  `RoleSeeder`/`PermissionSeeder`/`RolePermissionSeeder` direct plutôt que
  `MainSeeder`, cf. `admin_categories.spec.ts`) : liste, 403, changement de
  rôle, protection dernier owner (rétrogradation et retrait), retrait d'un
  membre simple (+ reset `currentOrganizationId`), transformer.
  `tests/inertia/organization_members.spec.ts` (rendu, options de rôle,
  boutons retirer). `tests/inertia/organization_settings.spec.ts` mis à jour
  (mock `@adonisjs/inertia/vue` pour `SectionNav`).

Hors périmètre (PR suivant) : invitations par email (PR 3).
