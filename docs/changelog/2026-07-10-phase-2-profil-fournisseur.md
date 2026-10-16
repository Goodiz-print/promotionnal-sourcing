# Phase 2 (PR 2/4) : profil fournisseur (CRUD + écran)

> Date : 2026-07-10

Un fournisseur édite le profil de son organisation courante (délais,
certifications, périmètre de livraison, MOQ, bio). S'appuie sur la fondation
données de la PR 1. Introduit la couche `app/services/`.

- **Routes** (préfixe `:locale`, middleware `auth`) : `GET /supplier/profile`
  (`supplier.profile`) et `PATCH /supplier/profile` (`supplier.profile.update`).
- **Controller** `app/controllers/supplier/profile_controller.ts` (fin) : org
  courante via `user.load('currentOrganization')`, `bouncer.authorize`, réponse en
  redirection Inertia + flash. Clé de registry générée : `controllers.supplier.Profile`.
- **Service** `app/services/supplier_profile_service.ts` (nouveau dossier) :
  `getForOrganization` / `upsertForOrganization` (`updateOrCreate` sur `organizationId`).
- **Validator** `app/validators/supplier_profile.ts` (VineJS, champs optionnels).
- **Transformer** `app/transformers/supplier_profile_transformer.ts` : retour typé
  `SupplierProfileType`, dates en ISO string.
- **Ability** `canManageSupplierProfile` : org `supplier`/`both` + membre `owner`/`admin`.
- **Frontend** `inertia/pages/supplier/profile.vue` (`useForm`, liste `certifications`
  dynamique) + i18n `resources/lang/{fr,en}/supplier.json`.
- **Type** : `SupplierProfileType` passé d'`interface` à `type` (contrainte
  `Record<string, JSONDataTypes>` des props Inertia).
- **Tests** : `tests/functional/supplier_profile.spec.ts` (200/403/upsert/transformer,
  Postgres) + `tests/inertia/supplier_profile.spec.ts` (Vitest). `authApiClient` ajouté
  au bootstrap ; alias `#shared` ajouté à `vitest.config.ts`. Résultat : pg → 36 passés ;
  sqlite → 19 passés, 17 sautés ; Vitest → 10 passés.
- **Doc** : `docs/organisations.md` (section « Endpoints & écran fournisseur »).
- **Suite revue #12** : extraction d'un kit de composants UI réutilisables
  `inertia/components/base_*` (`base_field`, `base_input` générique avec coercion
  nombre, `base_select`, `base_textarea`, `base_button` à variants) ; `profile.vue`
  refactoré pour les consommer (plus de classes Tailwind dupliquées). Tests
  `tests/inertia/base_components.spec.ts`.
- **Adoption dans les pages auth** : `auth/login.vue` et `auth/signup.vue`
  refactorées pour utiliser le kit `base_*` (passage de `<Form>` à `useForm` +
  `BaseInput`/`BaseButton`, `urlFor` pour l'URL de route). Test
  `tests/functional/auth.spec.ts` (inscription + connexion via `useForm`).
