# Paramètres généraux de l'organisation (PR 1/3 gestion des organisations)

> Date : 2026-07-17

Premier volet de la **gestion des organisations** (nouvelle série de 3 PR,
distincte de la Phase 2 déjà terminée) : un écran permet aux owner/admin de
modifier les informations générales de leur **organisation courante** (nom,
SIRET, TVA, coordonnées, secteur, taille, description, adresse, logo).
Accessible à tout type d'organisation (buyer/supplier/both), contrairement au
profil fournisseur. Le **slug reste non modifiable** dans cet écran.

- **Migration** : `organizations.logo_public_id` (nullable) — identifiant
  Cloudinary du logo, nécessaire pour supprimer l'asset remplacé.
- **Service** `app/services/organization_service.ts` : `update` (champs
  texte), `updateLogo` (upload Cloudinary + suppression de l'ancien logo),
  `removeLogo`. `CloudinaryService` injecté (testable sans appel réseau, cf.
  `SupplierProductService`).
- **Controller** `app/controllers/organization/settings_controller.ts` :
  `show` (GET) + `update` (**POST**, et non PATCH, pour porter le multipart
  de l'upload du logo — même convention que `supplier/products/:id`).
- **Routes** : `GET /:locale/organization/settings` (`organization.settings`),
  `POST /:locale/organization/settings` (`organization.settings.update`) —
  dans le groupe `onboarded` existant.
- **Ability** `canManageOrganization` (déjà écrite en Phase 2, jamais
  branchée) enfin utilisée : owner/admin uniquement, toute organisation.
- **Validator** `updateOrganizationValidator` : `logoUrl` (texte) remplacé par
  `logo: vine.file(...)` + `removeLogo: vine.boolean()` — le logo n'est plus
  une URL saisie mais un upload direct.
- **`OrganizationTransformer`** : correction, les dates étaient renvoyées en
  objets Luxon `DateTime` (incompatible props Inertia) — désormais `.toISO()`.
- **`OrganizationType`** (`shared/types/organization.ts`) : passé
  d'`interface` à `type` (contrainte `Record<string, JSONDataTypes>` des
  props Inertia — même raison que `SupplierProfileType`/`SupplierType`). Ajout
  de `UpdateOrganizationSettingsData` et de la const `ORGANIZATION_SIZES`
  (pattern const+union, aligné sur `DELIVERY_SCOPES`).
- **Écran** `inertia/pages/organization/settings.vue` + sous-composants
  `inertia/components/organization/settings/{general_fields,address_fields,logo_field}.vue`
  (provide/inject du formulaire, pattern `ProductFormKey`), upload logo via
  `base_file_input.vue` (déjà existant) + suppression via checkbox dédiée,
  i18n `resources/lang/{fr,en}/organization.json`.
- **Tests** : `tests/functional/organization_settings.spec.ts` (200/403,
  redirection onboarding si pas d'org courante, mise à jour des champs texte,
  upload/remplacement/suppression du logo via faux uploader Cloudinary,
  transformer), `tests/inertia/organization_settings.spec.ts` (rendu,
  pré-remplissage, absence de champ slug).
- **Infra dev** : `docker-compose.yml` corrigé — le montage du volume Postgres
  passe de `/var/lib/postgresql/data` à `/var/lib/postgresql` (convention
  `pg_ctlcluster` requise par les images officielles Postgres 18+, la
  précédente empêchait tout redémarrage propre du conteneur).

Hors périmètre (PR suivants) : gestion des membres existants (PR 2),
invitations par email (PR 3).
