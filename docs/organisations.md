# Organisations acheteur / fournisseur

Socle de données de la **Phase 2** (#3) : distinguer les organisations
**acheteur** des **fournisseur**, doter les fournisseurs d'un **profil détaillé**
(délais, certifications, périmètre de livraison), et **réconcilier** la table
`suppliers` — créée autonome par le catalogue (#2) — avec les `organizations`.

Décision produit : **un fournisseur = une organisation de type `supplier`,
multi-utilisateurs** (le socle multi-utilisateurs existe déjà via
`organization_users` + rôles owner/admin/manager/member). La fiche catalogue
`suppliers` _appartient_ à une organisation via une FK, plutôt que de fusionner
les deux tables (approche non destructive).

> Ce document couvre la **fondation données** (PR 1/4). Les endpoints, écrans et
> l'onboarding arrivent dans les PR suivantes (voir [Roadmap](#roadmap)).

## Tables

- **`organizations.organization_type`** — enum(`buyer`, `supplier`, `both`),
  `NOT NULL`, défaut `buyer`. Une organisation peut être acheteur, fournisseur,
  ou les deux. Migration `…961_alter_organizations_add_type`.
- **`suppliers.organization_id`** — FK nullable → `organizations`
  (`ON DELETE SET NULL`). **Cardinalité hasMany** : une organisation peut porter
  plusieurs fiches `suppliers` (ex. multi-marques) → **pas** de contrainte unique.
  Nullable pour les ~300 fiches importées avant rattachement (import ops à venir).
  Migration `…962_alter_suppliers_add_organization_id`.
- **`supplier_profiles`** — profil fournisseur au niveau organisation :
  `organization_id` **unique** (`ON DELETE CASCADE` → un profil par organisation),
  `min_order_quantity`, `delivery_days`, `delivery_scope` enum(`national`,
  `europe`, `worldwide`), `certifications text[]` (aligné sur la convention
  `synonyms` du catalogue — pas de jsonb), `bio`, `response_time_days`.
  Migration `…963_create_supplier_profiles_table`.

## Modèles & relations

- **`SupplierProfile`** (`app/models/supplier_profile.ts`) — `belongsTo(Organization)` ;
  override `declare deliveryScope: DeliveryScope | null` et
  `declare certifications: string[] | null` (l'introspection ORM les type
  `string | null` / `any`).
- **`Organization`** — `hasOne(SupplierProfile) supplierProfile`,
  `hasMany(Supplier) suppliers`, override `declare organizationType: OrganizationKind`
  (même pattern que `declare size` déjà présent).
- **`Supplier`** — `belongsTo(Organization) organization` (en plus de
  `hasMany(Product)` / `hasMany(SupplierTranslation)` existants).

## Types partagés (`shared/types/organization.ts`)

- `ORGANIZATION_TYPES` / `OrganizationKind` / `DEFAULT_ORGANIZATION_KIND` —
  pattern const+union, calqué sur `SUPPORTED_LOCALES`/`Locale`
  (`shared/types/i18n.ts`). Réutilisés par la migration (valeurs enum + défaut).
  > Le type union s'appelle **`OrganizationKind`** — et non `OrganizationType` —
  > pour ne pas entrer en collision avec l'interface `OrganizationType` (DTO de
  > l'organisation) déjà exportée par ce fichier.
- `DELIVERY_SCOPES` / `DeliveryScope` — idem pour le périmètre de livraison.
- `OrganizationType` (interface) gagne le champ `organizationType: OrganizationKind`.
- `SupplierProfileType` (nouvelle interface) — forme du profil exposée au frontend
  (`minOrderQuantity`, `deliveryDays`, `deliveryScope`, `certifications`, `bio`,
  `responseTimeDays`).

## Transformer & seeders

- **`OrganizationTransformer`** expose désormais `organizationType`. Le transformer
  `SupplierProfile` et le nesting `supplierProfile` arrivent avec le CRUD (PR 2).
- **`DevUserSeeder`** : l'org de démo passe en `buyer` ; une 2ᵉ organisation
  `eurogoods-org` de type `supplier` est créée (dev user en `owner`) avec son
  `SupplierProfile` (scope `europe`, certifications `ISO 9001`/`FSC`, MOQ 50).
- **`SupplierSeeder`** rattache la fiche catalogue `eurogoods` à l'organisation
  `eurogoods-org` (`suppliers.organization_id`). L'ordre du `MainSeeder`
  (`dev_user` avant `supplier`) garantit que l'organisation existe au rattachement.

## Fichiers clés

| Domaine        | Chemin                                                                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Migrations     | `database/migrations/{…961_alter_organizations_add_type,…962_alter_suppliers_add_organization_id,…963_create_supplier_profiles_table}.ts` |
| Modèles        | `app/models/{organization,supplier,supplier_profile}.ts`                                                                                  |
| Transformer    | `app/transformers/organization_transformer.ts`                                                                                            |
| Types partagés | `shared/types/organization.ts`                                                                                                            |
| Seeders        | `database/seeders/{dev_user,supplier}_seeder.ts`                                                                                          |

## Tests

- `tests/functional/organization_supplier.spec.ts` — type d'org (buyer/supplier),
  profil détaillé (`preload('supplierProfile')`, `certifications` typées),
  rattachement fiche↔organisation (`belongsTo` + `hasMany(suppliers)`), sortie du
  transformer.
- Sème via `MainSeeder` (qui inclut le catalogue pgvector/tsvector). Comme
  toute la suite, s'exécute sous PostgreSQL — voir `docs/tests.md`.

## Endpoints & écran fournisseur (PR 2)

Un fournisseur édite le profil de son **organisation courante**
(`user.currentOrganizationId`), qui doit être de type `supplier`/`both`.

- **Routes** (préfixe `:locale`, middleware `auth`) :
  - `GET /:locale/supplier/profile` → `supplier.profile` (écran d'édition).
  - `PATCH /:locale/supplier/profile` → `supplier.profile.update` (upsert).
- **Controller** `app/controllers/supplier/profile_controller.ts` (fin) : charge
  l'org courante (`user.load('currentOrganization')`, pas de `Model.query()`),
  autorise via l'ability, délègue au service, répond en **redirection Inertia**
  (flash `success`). 403 si pas d'org courante.
- **Service** `app/services/supplier_profile_service.ts` : `getForOrganization`,
  `upsertForOrganization` (`SupplierProfile.updateOrCreate` sur `organizationId`).
- **Validator** `app/validators/supplier_profile.ts` : tous les champs optionnels
  (`vine.number().min(0)`, `vine.enum(DELIVERY_SCOPES)`, `vine.array(vine.string())`).
- **Ability** `canManageSupplierProfile` (`app/abilities/main.ts`) : org
  `supplier`/`both` **et** membre `owner`/`admin`.
- **Transformer** `supplier_profile_transformer.ts` : retour typé `SupplierProfileType`
  (dates converties en ISO string pour la sérialisation Inertia).
- **Écran** `inertia/pages/supplier/profile.vue` : `useForm` (liste `certifications`
  dynamique), périmètre en `<BaseSelect>`, i18n `resources/lang/{fr,en}/supplier.json`.
  Construit sur un **kit de composants réutilisables** `inertia/components/base/base_*`
  (`base_field`, `base_input` générique avec coercion nombre, `base_select`,
  `base_textarea`, `base_button` à variants) — plus aucune classe Tailwind dupliquée.
  Le DTO `SupplierProfileType` est déclaré en **`type`** (et non `interface`) pour
  satisfaire la contrainte `Record<string, JSONDataTypes>` des props Inertia.
- **Tests** : `tests/functional/supplier_profile.spec.ts` (200 fournisseur, 403
  acheteur, upsert, transformer — Postgres) + `tests/inertia/supplier_profile.spec.ts`
  (rendu, options, pré-remplissage, add/remove certif). `authApiClient` ajouté au
  bootstrap ; alias `#shared` ajouté à `vitest.config.ts`.

## Onboarding acheteur/fournisseur (PR 3)

Le **signup ne crée qu'un `User`** (pas d'organisation → `currentOrganizationId = null`).
L'onboarding **crée la première organisation** de l'utilisateur et fixe son type.

- **Signal « à onboarder »** = `user.currentOrganizationId == null` (aucun flag/migration DB).
- **Flux** : signup **ou** login sans org courante → redirection vers `onboarding.show`.
  L'écran demande le **nom d'organisation** + le **type** (acheteur/fournisseur). Le
  `POST` crée l'`Organization` (slug dérivé du nom, `country` FR), rattache l'utilisateur
  en **`owner`** (`organization_users`), fixe `currentOrganizationId`, puis redirige à l'accueil.
- **Routes** (`:locale` + `auth`) : `GET /onboarding` (`onboarding.show`), `POST /onboarding`
  (`onboarding.store`).
- **Gate** : middleware `onboarded` (`app/middleware/onboarded_middleware.ts`, nommé dans
  `start/kernel.ts`) — un utilisateur org-less accédant à un écran nécessitant une organisation
  (ex. `supplier/profile`) est redirigé vers l'onboarding. **Non appliqué** aux routes
  onboarding/logout (anti-boucle).
- **Service** `app/services/onboarding_service.ts` (`completeOnboarding`) : slug unique via
  `stringHelpers.slug` + suffixe, création org + adhésion `owner` + org courante (miroir de
  `dev_user_seeder`). **Validator** `app/validators/onboarding.ts` (`ONBOARDING_TYPES` = buyer/supplier).
- **Frontend** `inertia/pages/onboarding/index.vue` (`useForm`) + composant réutilisable
  `inertia/components/base/base_radio_group.vue` (cartes radio génériques) + i18n
  `resources/lang/{fr,en}/onboarding.json`.
- **Tests** : `tests/functional/onboarding.spec.ts` (redirection signup→onboarding, rendu écran,
  création org+owner+org courante, déjà-onboardé, gate middleware — seed `RoleSeeder`) +
  `tests/inertia/onboarding.spec.ts` et test unitaire `base_radio_group`.

## Annuaire public fournisseurs (PR 4)

Expose **publiquement** (sans auth) le catalogue des fournisseurs : liste filtrable + fiche
détaillée (profil fournisseur + catalogue produits). S'appuie sur les fiches `suppliers`
(catalogue) et le lien `Supplier → Organization → SupplierProfile`.

- **Routes publiques** (`:locale`, hors auth) : `GET /suppliers` (`suppliers.index`),
  `GET /suppliers/:slug` (`suppliers.show`).
- **Controller** `app/controllers/suppliers_controller.ts` (fin, public) : lit `search`/`country`/`page`
  (query), délègue au service, sérialise via transformers. `show` → 404 si fiche introuvable/inactive.
- **Service** `app/services/supplier_directory_service.ts` : `list` (filtre pays `where`, recherche par
  **nom localisé** `whereHas('translations').whereILike`, `paginate`), `findBySlug` (preload
  `translations` + `products.translations` + `organization.supplierProfile`), `availableCountries`.
- **Transformers** : `SupplierTransformer` (liste) et nouveau `SupplierDetailTransformer` (fiche =
  supplier + `supplierProfile` si org liée + `products`). ⚠️ **`SupplierTransformer` et
  `ProductTransformer` rendus Inertia-safe** : retour typé (`SupplierType`/`ProductType`) et **dates
  converties en ISO string** (comme `SupplierProfileTransformer`). `SupplierType`/`ProductType` passés
  d'`interface` à **`type`** (contrainte `Record<string, JSONDataTypes>` des props Inertia).
- **Types partagés** : `SupplierDetailType`, `SupplierDirectoryFilters` (`shared/types/supplier.ts`),
  `Paginated<T>`/`PaginationMeta` (`shared/types/pagination.ts`, réutilisables).
- **Frontend** : `inertia/pages/suppliers/{index,show}.vue` + composants réutilisables
  `inertia/components/{supplier_card,product_card}.vue` (règle #13) ; filtres via
  `router.get(..., { preserveState, preserveScroll, only })` (debounce recherche) ; i18n
  `resources/lang/{fr,en}/suppliers.json` (le profil réutilise `supplier.fields.*`/`supplier.deliveryScope.*`).
- **Tests** : `tests/functional/suppliers_directory.spec.ts` (liste, filtre pays, recherche, fiche
  profil+produits, profil null, 404, localisation — Postgres) + `tests/inertia/suppliers.spec.ts`.

## Paramètres généraux de l'organisation (PR org-settings 1/3)

Nouvelle série de **3 PR** pour la **gestion des organisations** (distincte de
la Phase 2 ci-dessus, qui posait uniquement la fondation données) : PR1 =
paramètres généraux (cette section), PR2 = gestion des membres existants
(rôle, retrait), PR3 = invitations par email.

Un owner/admin édite les informations générales de son **organisation
courante** (`user.currentOrganizationId`) : nom, SIRET, TVA, coordonnées,
secteur, taille, description, adresse, logo. **Slug non modifiable** ici.
Accessible à toute organisation (buyer/supplier/both) — contrairement au
profil fournisseur, réservé aux `supplier`/`both`.

- **Migration** `…965_alter_organizations_add_logo_public_id` (historique, Cloudinary)
  puis `…973_replace_cloudinary_references_with_storage_objects` :
  `logo_public_id` est remplacé par `logo_storage_object_id` (FK `storage_objects`).
- **Service** `app/services/organization_service.ts` : `update`, `updateLogo`
  (stockage dédoublonné + `pending_delete` de l'ancien logo dans la même
  transaction), `removeLogo`. `StorageService`
  injecté (testable sans appel réseau, cf. `SupplierProductService`).
- **Controller** `app/controllers/organization/settings_controller.ts` :
  `show` (GET) + `update` (POST multipart, pour porter l'upload du logo).
  Ability `canManageOrganization` (écrite en Phase 2, enfin branchée).
- **Validator** `app/validators/organization.ts` (`updateOrganizationValidator`) :
  `logo: vine.file(...)` + `removeLogo: vine.boolean()` remplacent `logoUrl`
  (texte) — l'upload est direct, pas une URL saisie.
- **Transformer** `OrganizationTransformer` corrigé (dates ISO, comme
  `SupplierProfileTransformer`). `OrganizationType` passé en `type` (contrainte
  props Inertia) ; ajout de `UpdateOrganizationSettingsData` et de la const
  `ORGANIZATION_SIZES` (pattern const+union, aligné sur `DELIVERY_SCOPES`).
- **Écran** `inertia/pages/organization/settings.vue` (< 250 lignes) + sous-
  composants `inertia/components/organization/settings/*` (provide/inject,
  pattern `ProductFormKey`/`ProductFormState`), suppression du logo via
  checkbox dédiée (pas de valeur `null` envoyée en multipart).
- **i18n** `resources/lang/{fr,en}/organization.json`.
- **Tests** `tests/functional/organization_settings.spec.ts` (200/403,
  redirection onboarding, mise à jour texte, upload/remplacement/suppression
  logo via faux uploader, transformer) + `tests/inertia/organization_settings.spec.ts`.
- **Infra dev** : `docker-compose.yml` corrigé (montage `/var/lib/postgresql`
  au lieu de `/var/lib/postgresql/data`) — les images Postgres 18+ refusent
  l'ancienne convention de montage, ce qui bloquait tout redémarrage du
  conteneur local, indépendamment de pgvector.

## Gestion des membres de l'organisation (PR org-settings 2/3)

Un owner/admin liste les membres de son organisation courante, change leur
rôle (owner/admin/manager/member) et les retire. **Pas d'invitation par
email** dans ce PR (PR3).

Garde métier centrale : **une organisation garde toujours au moins un
owner** — impossible de rétrograder ou retirer le dernier owner
(`LastOwnerException`, interceptée dans le controller → flash `error` +
redirection, jamais rendue en page d'erreur générique).

- **Exceptions** `app/exceptions/organization_errors.ts` : `LastOwnerException`
  (422), `OrganizationMemberNotFoundException` (404, membre hors organisation).
- **Service** `app/services/organization_members_service.ts` : `listMembers`,
  `findMember`, `changeRole`, `removeMember`. Un membre retiré dont
  l'organisation courante était celle-ci voit `currentOrganizationId` remis à
  `null` (repasse par l'onboarding à la prochaine visite).
- **Controller** `app/controllers/organization/members_controller.ts` :
  `index`/`update`/`destroy`, ability `canManageMembers` (écrite en Phase 2,
  enfin branchée — owner/admin uniquement, y compris pour la simple lecture
  de la liste).
- **Routes** : `GET organization/members`, `PATCH organization/members/:id`,
  `DELETE organization/members/:id`.
- **Types** : `RoleType`/`PermissionType`/`RoleWithPermissionsType`
  (`shared/types/role.ts`) et `OrganizationMemberType`
  (`shared/types/organization.ts`) passés d'`interface` à `type` — la
  contrainte props Inertia (`Record<string, JSONDataTypes>`) s'applique aussi
  aux types **nichés** dans un DTO (`OrganizationMemberType.role: RoleType`),
  pas seulement au DTO racine. `RoleTransformer` corrigé en conséquence
  (retour typé `RoleType`, `slug` casté en `RoleSlug`).
- **Écran** `inertia/pages/organization/members.vue` : tableau + `<select>`
  de rôle par ligne (mutation ponctuelle `router.patch`, `preserveScroll`,
  premier usage de ce pattern dans le projet) + retrait (`window.confirm` +
  `router.delete`, repris de `admin/categories/index.vue`). Nouveau composant
  partagé `inertia/components/organization/section_nav.vue` (onglets
  Paramètres/Membres) sur `organization/{settings,members}.vue`.
- **Tests** `tests/functional/organization_members.spec.ts` (seed direct
  `RoleSeeder`/`PermissionSeeder`/`RolePermissionSeeder`, pattern
  `admin_categories.spec.ts`, plutôt que `MainSeeder`) : liste, 403, rôle,
  protection dernier owner (rétrogradation + retrait), retrait simple,
  transformer. `tests/inertia/organization_members.spec.ts`.

## Invitations de membres par email (PR org-settings 3/3)

Un owner/admin/manager invite un nouveau membre par email (formulaire sur
l'écran membres). L'invité reçoit un lien, se connecte ou crée un compte si
besoin (email préfilé, retour automatique sur l'invitation après
authentification), puis rejoint l'organisation avec le rôle proposé.

**Décision d'architecture** : pas de token stocké en base. Le lien s'appuie sur
le mécanisme natif d'URL signée d'AdonisJS v7 (`signedUrlFor(routeName, params,
{ expiresIn, purpose })` / `request.hasValidSignature(purpose)`,
`@adonisjs/core/services/url_builder`) — l'expiration est encodée dans la
signature elle-même. La table `organization_invitations` (`organization_id`,
`email`, `role_id`, `invited_by_user_id`, `status` `pending`/`accepted`/`revoked`,
`expires_at`) ne porte que l'état métier (liste, révocation, affichage), pas de
secret.

- **Service** `app/services/organization_invitations_service.ts` : `invite`
  (rejette si l'email est déjà membre — `AlreadyMemberException` — et
  rafraîchit une invitation en attente existante pour le même email plutôt que
  d'en créer une seconde), `revoke`, `findById`, `accept` (idempotent, fixe
  `currentOrganizationId` si absente).
- **Mail** `app/mails/organization_invitation_notification.ts` +
  `resources/views/emails/organization_invitation.edge`, envoyé via
  `mail.sendLater()` (file interne en mémoire à `@adonisjs/mail`, pas la
  file `@adonisjs/queue` du projet — ne survit pas à un redémarrage du
  process, acceptable pour ce volume). Aucune infra mail n'existait avant ce
  PR.
- **Controllers** :
  - `app/controllers/organization/invitations_controller.ts` (`store`/
    `destroy`, ability `canInviteMembers` — owner/admin/**manager**, écrite en
    Phase 2, jamais branchée avant ce PR).
  - `app/controllers/organization/invitation_acceptance_controller.ts` :
    `show` **public** (route hors auth, dans le groupe de routes publiques
    avec `suppliers`/`products`), `accept` **authentifié mais hors
    `onboarded`** (même exemption que `onboarding`/`logout` — un invité sans
    organisation ne doit pas être bloqué avant d'accepter). La signature ne
    protège que `show` (empêche l'énumération d'ids) ; `accept` s'appuie sur
    auth + email du compte connecté = email invité + statut `pending` non
    expiré, sans revérifier la signature (le bouton "Accepter" poste sur
    `acceptActionUrl`, l'URL exacte de la page chargée — jamais reconstruite
    via `urlFor` côté client, qui perdrait la querystring signée).
  - `members_controller.ts#index` étendu : précharge les invitations en
    attente, expose `canManageMembers` en plus (désormais gate de l'écran via
    `canInviteMembers`, plus permissif) — un manager voit l'écran et peut
    inviter, mais les contrôles rôle/retrait sont masqués côté écran (en plus
    du 403 backend).
- **Redirection post-authentification** — `shared/helpers/safe_redirect.ts`
  (`isSafeRedirectPath`, chemin `/<locale>/...` uniquement, jamais une URL
  absolue) : `session_controller.ts`/`new_account_controller.ts` lisent
  `?redirect=...` pour ramener l'invité sur l'invitation après connexion/
  inscription. ⚠️ **Piège** : `config/app.ts` active `forwardQueryString: true`
  par défaut sur tous les redirects — toute redirection vers une cible
  dynamique doit explicitement `.withQs(false)`, sinon la querystring de la
  requête courante se retrouve dupliquée/propagée sur la destination (rencontré
  et corrigé pendant ce PR, cf. `docs/changelog/`).
- **Écrans** `inertia/pages/organization/invitation_{accept,invalid}.vue` +
  extension de `organization/members.vue` (nouveaux composants
  `inertia/components/organization/members/{invite_form,pending_invitations,members_table}.vue`).
  `auth/{login,signup}.vue` acceptent un prop `redirect` (+ `email` pour
  signup).
- **Tests** `tests/functional/organization_invitations.spec.ts` (8) et
  `organization_invitation_acceptance.spec.ts` (10, dont redirection post-
  auth) — `mail.fake()`. `tests/unit/safe_redirect.spec.ts`,
  `tests/inertia/organization_invitation_accept.spec.ts`.

## Renvoi d'une invitation (PR org-settings 4/3)

Un owner/admin/manager peut **renvoyer** le mail d'une invitation restée en
attente (invité qui ne l'a pas reçue, lien expiré) depuis la liste des
invitations, sans en créer une seconde ni ressaisir l'email.

- **Route** : `POST organization/invitations/:id/resend`
  (`organization.invitations.resend`), même ability `canInviteMembers` que
  l'envoi et la révocation.
- **Service** `OrganizationInvitationsService#resend` : **prolonge**
  `expires_at` d'un nouveau TTL (7 jours) et précharge `role`/`invitedBy` pour
  la composition du mail. L'invitation **reste rattachée à son auteur
  d'origine** (`invited_by_user_id` inchangé) — renvoyer n'est pas réinviter, et
  l'email continue d'annoncer la bonne personne. Rejette toute invitation déjà
  `accepted` ou `revoked` (`InvitationNotPendingException`, 422, interceptée
  dans le controller → flash `error`).
- **Lien** : un **nouveau lien signé** est généré (`signedUrlFor`, `expiresIn:
'7d'`) — aucun token n'étant stocké, le lien précédemment envoyé reste valide
  jusqu'à sa propre échéance. Révoquer l'invitation reste le moyen d'invalider
  immédiatement un lien en circulation (l'acceptation vérifie le statut en base).
- **Controller** : le chargement de l'invitation est factorisé en
  `findInOrganization(id, organizationId)`, partagé avec `destroy` — un id
  appartenant à une autre organisation donne un **404** (pas de fuite
  d'existence), pas un 403.
- **Écran** : bouton « Renvoyer » par ligne dans
  `inertia/components/organization/members/pending_invitations.vue`
  (`router.post`, `preserveScroll`, **sans** `window.confirm` — l'action est
  sans effet destructif, contrairement à la révocation). i18n
  `organization.invitations.{resend,resent,notPending}`.
- **Tests** : `tests/functional/organization_invitations.spec.ts` (+4 —
  prolongation de l'expiration + mail remis en file sans doublon, invitation
  révoquée refusée, invitation d'une autre organisation en 404, membre simple
  bloqué) et `tests/inertia/organization_members.spec.ts` (+1).

## Purge des invitations expirées (PR org-settings 5/3)

Les invitations en attente dont l'échéance était passée restaient `pending`
indéfiniment : plus acceptables (le contrôleur d'acceptation vérifie
`expires_at`), mais toujours listées comme en attente sur l'écran membres. Un
job planifié fait désormais le ménage.

- **Statut `expired`** ajouté à `INVITATION_STATUSES`
  (`shared/types/organization.ts`) et à la contrainte CHECK de
  `organization_invitations.status` (migration
  `…967_alter_organization_invitations_add_expired_status`). `table.enu()`
  produisant sous Postgres une colonne varchar + CHECK, la migration passe par
  du **SQL brut** (knex n'expose pas d'API pour étendre l'énumération d'une
  colonne existante) ; le `down()` remet les lignes `expired` en `pending`
  avant de restaurer l'ancienne contrainte. Ce statut n'est **jamais** posé par
  une action utilisateur.
- **Service** `OrganizationInvitationsService#purgeExpired(now?)` en deux temps :
  1. les invitations `pending` dont `expires_at` est dépassé passent `expired` —
     elles sortent donc de `listPending`, et l'écran membres ne les affiche plus ;
  2. les invitations en **état terminal** (`expired`/`revoked`) créées il y a plus
     de `TERMINAL_RETENTION_DAYS` (**90 jours**) sont **supprimées**. Les
     invitations `accepted` ne le sont jamais : elles tracent l'origine d'une
     adhésion encore active.

  Retourne `{ expired, deleted }` (`PurgeInvitationsResult`). `now` est
  paramétrable — c'est ce qui rend la rétention testable sans horloge figée.

- **Job** `app/jobs/purge_expired_invitations_job.ts`, planifié dans
  `start/scheduler.ts` **tous les jours à 03:15 Europe/Paris**
  (`.id('purge-expired-invitations')`, l'id rend la planification idempotente au
  redémarrage). Le scheduler n'étant préchargé qu'en environnement `web`
  (`adonisrc.ts`), il ne tourne pas pendant les tests.
  > Le job importe `OrganizationInvitationsService` **dynamiquement dans
  > `execute()`** : la queue charge les modules de job au boot, or ce service
  > importe des modèles Lucid — même contrainte que le modèle `Product` dans
  > `GenerateProductEmbeddingJob` (cf. règle DI de `CLAUDE.md`).
- **Conséquence produit** : une invitation échue n'est plus « renvoyable »
  (`resend` exige `pending`) une fois basculée — il faut ré-inviter l'email, ce
  que `invite()` gère sans doublon (aucune invitation `pending` ne subsiste).
  Tant que le job n'est pas passé, le bouton « Renvoyer » reste disponible et
  prolonge l'échéance comme avant.
- **Tests** : `tests/functional/organization_invitations.spec.ts` (+3 — bascule
  des seules invitations échues, suppression après rétention hors `accepted`,
  disparition de l'écran membres).

## Cycle de vie de l'organisation — socle backend (PR lifecycle 1/3)

Créer une organisation supplémentaire, la quitter, l'archiver. Les décisions
produit qui cadrent ce volet :

| Sujet                                 | Décision                                                           |
| ------------------------------------- | ------------------------------------------------------------------ |
| Sélecteur d'organisation              | Affiché **uniquement** si l'utilisateur a ≥ 2 organisations (PR 2) |
| Acceptation d'une invitation          | **Bascule automatique** sur l'organisation rejointe (#32)          |
| Créer une organisation supplémentaire | Autorisé, avec **bascule automatique** dessus                      |
| Supprimer                             | **Archivage réversible**, jamais de DELETE                         |
| Droit d'archiver                      | `owner` + `admin` (ability existante `canManageOrganization`)      |
| Membres d'une organisation archivée   | Bascule auto sur une autre adhésion, sinon onboarding              |
| Restauration                          | Hors UI (`archived_at` remis à `NULL` en base)                     |
| Quitter en tant que dernier owner     | **Bloqué** (`LastOwnerException`)                                  |

### `organizations.archived_at`

Migration `…968_alter_organizations_add_archived_at`. Pas de suppression
physique : `suppliers.organization_id` est en `ON DELETE SET NULL`, donc un
DELETE laisserait la fiche fournisseur **et ses produits** orphelins mais
toujours publiés (le catalogue public ne filtre que sur `is_active`). L'archivage
garde tout, réversible.

### `OrganizationContextService`

Nouveau service **sans dépendance** (`app/services/organization_context_service.ts`)
— quelle organisation est la courante, lesquelles restent accessibles, sur
laquelle retomber :

- `currentFor(user)` — organisation courante, `NoCurrentOrganizationException` si
  absente **ou archivée**. Remplace le helper privé qui était dupliqué dans six
  controllers (`organization/{settings,members,invitations}`,
  `supplier/{profile,product}`, `admin/category`).
- `membershipsFor(user)` — adhésions aux organisations **non archivées**,
  organisation et rôle préchargés. Alimentera le sélecteur (PR 2).
- `fallbackFor(user, excluding?)` / `reassignCurrentOrganization(user, leavingId)` —
  calcul et application de l'organisation de repli après un départ ou un retrait.
- `switchTo(user, organizationId)` — bascule explicite ; rejette une organisation
  étrangère (`NotAMemberException`) ou archivée (`OrganizationArchivedException`).
- `ensureUsableOrganization(user)` — utilisé par le middleware `onboarded`.

> Pourquoi un service séparé plutôt que des méthodes d'`OrganizationService` :
> `OrganizationMembersService#removeMember` en a besoin, et `OrganizationService`
> a besoin de `OrganizationMembersService` (invariant « dernier owner ») — les
> garder ensemble créerait un **cycle d'injection**.

### Création, départ, archivage (`OrganizationService`)

- `create(user, data)` — organisation + adhésion `owner` + bascule, dans une
  **transaction** (les trois écritures forment un tout). `OnboardingService`
  n'est plus qu'un appelant : le même code sert la première organisation et les
  suivantes.
- `leave(user, organization)` — adhésion requise (`NotAMemberException`), refus si
  dernier owner (`LastOwnerException`, exactement l'invariant du retrait par un
  admin), puis repli sur une autre organisation.
- `archive(organization)` — pose `archived_at` et **révoque les invitations en
  attente** de l'organisation : aucun token n'étant stocké, un lien signé déjà
  envoyé resterait sinon valide jusqu'à son échéance.

### Effets de l'archivage

- **Membres** — rien n'est supprimé. À leur requête suivante, `OnboardedMiddleware`
  constate que l'organisation courante n'est plus utilisable et bascule sur une
  autre adhésion, ou renvoie vers l'onboarding. Le middleware couvre désormais
  trois cas de plus qu'avant : organisation archivée, adhésion retirée, départ
  volontaire.
- **Catalogue public** — scopes Lucid `Supplier.fromLiveOrganization` et
  `Product.fromLiveOrganization`, appliqués dans `SupplierDirectoryService`
  (liste, fiche, pays disponibles) et `ProductCatalogueService` (liste, fiche,
  catégories disponibles). `whereDoesntHave` et non une jointure : les fiches
  **sans** organisation (≈300 imports non encore rattachés, cf. #21) doivent
  rester visibles.
- **Invitations** — celles en attente passent `revoked`, et
  `InvitationAcceptanceController` refuse en plus toute invitation vers une
  organisation archivée.

### Tests

`tests/functional/organization_lifecycle.spec.ts` — 11 tests : bascule à la
création, repli au départ, départ sans autre organisation, dernier owner bloqué,
départ d'une organisation étrangère, révocation des invitations à l'archivage,
double archivage refusé, bascule interdite (étrangère/archivée), membre d'une
organisation archivée avec et sans autre adhésion, disparition de l'annuaire
public (fiche orpheline conservée).

## Sélecteur d'organisation et création (PR lifecycle 2/3)

### Sélecteur, seulement au-delà d'une organisation

`inertia/components/organization/organization_switcher.vue`, placé dans le header
de `inertia/layouts/default.vue`, **rendu uniquement si l'utilisateur a plus
d'une organisation** : avec une seule, elle est imposée par le contexte
(onboarding ou acceptation d'invitation) et il n'y a rien à choisir.

Il s'appuie sur deux props partagées ajoutées à `InertiaMiddleware#share()` :

- `organizations` — organisations **vivantes** de l'utilisateur
  (`OrganizationContextService#membershipsFor` +
  `OrganizationSummaryTransformer`) : une organisation archivée en sort
  automatiquement ;
- `currentOrganizationId` — pour présélectionner la courante.

`share()` devient `async` (une requête, uniquement pour un utilisateur connecté).

> ⚠️ `currentOrganizationId` vaut `undefined`, **jamais `null`** : le sérialiseur
> de props d'`@adonisjs/http-transformers` lève
> `Cannot serialize an item with null value`, ce qui fait tomber en 500 toutes
> les pages rendues sans utilisateur (catalogue, login…). Le prop `user` suivait
> déjà cette convention.

### Routes et controller

`app/controllers/organization/lifecycle_controller.ts`, sous le middleware
`onboarded` :

| Route                          | Nom                   | Rôle                |
| ------------------------------ | --------------------- | ------------------- |
| `POST organization/switch/:id` | `organization.switch` | Bascule (sélecteur) |
| `GET organization/new`         | `organization.create` | Écran de création   |
| `POST organization/new`        | `organization.store`  | Création + bascule  |

Basculer sur une organisation étrangère ou archivée donne un **flash d'erreur**
et un `redirect().back()`, pas une page d'erreur : le sélecteur peut afficher un
état obsolète (organisation archivée entre deux requêtes), ce n'est pas une faute
de l'utilisateur.

### Création d'une organisation supplémentaire

Écran `inertia/pages/organization/create.vue`. Les champs (nom + type
acheteur/fournisseur) sont **extraits** en
`inertia/components/organization/form/organization_form_fields.vue`, partagé avec
`inertia/pages/onboarding/index.vue` — le formulaire est passé par
provide/inject (`OrganizationFormKey`), même pattern que les paramètres généraux.
Le validator est celui de l'onboarding : payload identique, slug dérivé du nom
côté service.

La création **bascule** sur la nouvelle organisation — c'est l'intention de qui
la crée. Le point d'entrée est dans la nav des paramètres
(`section_nav.vue`) : le sélecteur étant masqué tant qu'on n'a qu'une
organisation, il ne peut pas porter cette action.

### Tests

`tests/functional/organization_lifecycle.spec.ts` (+6 : props du sélecteur,
exclusion d'une organisation archivée, bascule, bascule refusée sur une
organisation étrangère, écran de création, création qui bascule) et
`tests/inertia/organization_switcher.spec.ts` (masqué à une organisation, listé
au-delà, `router.post` au changement et no-op sur la courante).

## Quitter et archiver (PR lifecycle 3/3)

### Routes

| Route                       | Nom                    | Autorisation                            |
| --------------------------- | ---------------------- | --------------------------------------- |
| `DELETE organization/leave` | `organization.leave`   | Être membre                             |
| `POST organization/archive` | `organization.archive` | `canManageOrganization` (owner + admin) |

### Départ

`OrganizationService#leave` applique l'invariant du dernier owner ; le controller
le traduit en flash explicite (« promouvez un autre membre ou archivez
l'organisation »). Le bouton est en plus **masqué** dans ce cas : l'écran reçoit
une prop `canLeave` calculée par `OrganizationService#canLeave` (membre, et pas
dernier owner). Après le départ, repli sur une autre organisation ou onboarding.

### Archivage

Le controller enchaîne `archive` puis `ensureUsableOrganization` sur l'auteur de
l'archivage : sans cela il resterait rattaché à une organisation morte jusqu'à sa
requête suivante. Les autres membres, eux, basculent paresseusement via le
middleware `onboarded`.

### UI

`inertia/components/organization/settings/danger_zone.vue`, en bas de
`inertia/pages/organization/settings.vue` — composant extrait pour tenir sous les
250 lignes. `window.confirm` (pattern du projet pour les actions destructives,
aucun composant de modale générique n'existe) et nouveau variant **`danger`** de
`base_button`, basé sur les tokens `--state-danger` / `--state-danger-bg`.

> ⚠️ **Limite connue** — l'écran des paramètres est réservé aux owner/admin
> (`canManageOrganization`), et celui des membres aux owner/admin/manager
> (`canInviteMembers`). Un **membre simple n'a donc aucun écran** d'où quitter son
> organisation : la route l'autorise, mais rien ne la lui expose. Il faudrait un
> écran « mes organisations » accessible à tout membre — c'est aussi l'endroit
> naturel pour la création d'une organisation supplémentaire, aujourd'hui logée
> dans la nav des paramètres.

### Tests

`tests/functional/organization_lifecycle.spec.ts` (+5 : départ avec repli, dernier
owner refusé, `canLeave` exposé selon le rôle, archivage par un owner, archivage
refusé à un membre simple) et `tests/inertia/organization_danger_zone.spec.ts`
(départ masqué sans `canLeave`, confirmation acceptée/refusée, archivage).

## Bascule sur l'organisation rejointe à l'acceptation (#32)

Accepter une invitation **bascule toujours** l'organisation courante sur celle de
l'invitation — `OrganizationInvitationsService#accept()` écrit
`users.current_organization_id` sans condition, là où il ne le faisait
qu'en l'absence de valeur.

**Pourquoi** : le sélecteur d'organisation n'apparaît qu'à partir de deux
adhésions (cf. PR lifecycle 2/3). Sans bascule automatique, un invité déjà
membre ailleurs voyait son adhésion créée en base mais restait sur son
organisation d'origine : l'invitation semblait sans effet, et rien à l'écran ne
menait à la nouvelle organisation. Cliquer le lien d'invitation, c'est vouloir
travailler sur cette organisation-là.

**Règle produit** — le multi-organisation est conservé (un contact peut
travailler pour un acheteur _et_ un fournisseur) : l'adhésion précédente reste
intacte, seule la courante change. Basculer n'est pas quitter ; l'utilisateur
revient sur l'ancienne via le sélecteur, qui devient justement visible puisqu'il
a désormais deux adhésions.

**Flash** : `organization.invitations.accept.success` est paramétré par
`{organization}` (« Vous avez rejoint Acme. ») — la bascule est nommée, donc
lisible, plutôt que subie.

**Écrans** : rien à faire côté front. Les props partagées `organizations` et
`currentOrganizationId` sont `inertia.always(...)` (`InertiaMiddleware`) et les
écrans lisent l'organisation courante via `OrganizationContextService#currentFor`
— la redirection vers l'accueil qui suit l'acceptation les recalcule.

**Tests** : `tests/functional/organization_invitation_acceptance.spec.ts` (+1 —
un membre d'Acme accepte une invitation pour Beta : courante = Beta, flash
nommant Beta, les deux adhésions conservées).

## Rôles : organisation vs plateforme (#47)

Deux niveaux de rôle **indépendants** :

| Niveau       | Où                           | Valeurs                               | Sert à                                                         |
| ------------ | ---------------------------- | ------------------------------------- | -------------------------------------------------------------- |
| Organisation | `organization_users.role_id` | `owner`, `admin`, `manager`, `member` | Gérer _une_ organisation (membres, produits, RFQ…)             |
| Plateforme   | `users.platform_role`        | `none` (défaut), `admin`              | Back-office `/admin/**` et ressources **globales** (taxonomie) |

Le rôle d'organisation n'ouvre **jamais** une ressource globale : un `owner` d'organisation ordinaire reçoit un 403 sur `/admin/**`. Inversement un admin plateforme n'a besoin d'aucune adhésion (il n'est pas redirigé vers l'onboarding).

- **Colonne** : `users.platform_role` enum(`none`, `admin`), défaut `none` (migration `alter_users_add_platform_role`). Constantes et type `PlatformRole` dans `shared/types/user.ts`.
- **Modèle** : `User.platformRole` et le getter `User.isPlatformAdmin`.
- **Ability** `isPlatformAdmin` (`app/abilities/main.ts`) ; `canManageCategories` en dépend désormais et **ne prend plus d'organisation**.
- **Middleware** nommé `platformAdmin` (`app/middleware/platform_admin_middleware.ts`) : posé sur le groupe `/:locale/admin/**`, après `auth` et `emailVerified`, hors `onboarded`. Anonyme → connexion ; connecté sans rôle plateforme → 403.
- **Attribution** : aucun écran, uniquement les commandes ace (via `PlatformAdminService`, idempotent, email insensible à la casse) :

```bash
node ace admin:grant  alice@example.com
node ace admin:revoke alice@example.com
```

Sortie 1 si l'email ne correspond à aucun compte.

- **Seed de démo** : `DevUserSeeder` crée `admin@promotionnal-sourcing.test` (mot de passe `password`, admin plateforme, sans organisation) ; le compte de démo `malolebrin@gmail.com` reste un utilisateur ordinaire.
- **Menu** : `UserTransformer` expose `isPlatformAdmin` ; l'entrée « Administration » du header n'apparaît que pour eux (simple confort d'affichage : l'accès est garanti côté serveur).

### Back-office minimal (`/:locale/admin`)

| Route                          | Nom                         | Écran                                                                                                               |
| ------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `GET /admin`                   | `admin.dashboard`           | `admin/dashboard` — compteurs organisations (actives/archivées), utilisateurs, produits, RFQ                        |
| `GET /admin/organizations`     | `admin.organizations.index` | liste paginée (25), filtres `type` (`buyer`/`supplier`/`both`) et `status` (`active` par défaut, `archived`, `all`) |
| `GET /admin/organizations/:id` | `admin.organizations.show`  | fiche : coordonnées, volumes produits/RFQ, membres + rôle (404 si inconnue, archivées comprises)                    |
| `GET /admin/users`             | `admin.users.index`         | liste paginée (25), recherche `search` partielle et insensible à la casse sur l'email (jokers `%`/`_` échappés)     |
| `/admin/categories/**`         | `admin.categories.*`        | taxonomie, cf. `docs/catalogue.md`                                                                                  |

Architecture : controllers fins dans `app/controllers/admin/`, services `AdminDashboardService` / `AdminOrganizationService` / `AdminUserService`, transformers `Admin*Transformer`, types dans `shared/types/admin.ts`, pages `inertia/pages/admin/**` et navigation dédiée `inertia/components/admin/admin_nav.vue`. Les paramètres de filtre inconnus sont ignorés (repli sur les défauts). La page liste des organisations expose sa pagination dans la prop `organizationList` (et non `organizations`, déjà prise par le sélecteur d'organisation partagé).

Tests : `tests/functional/admin_platform_role.spec.ts` (accès, commandes, comptes de démo), `admin_dashboard.spec.ts`, `admin_organizations.spec.ts`, `admin_users.spec.ts`, `admin_categories.spec.ts` (non-régression owner → 403) ; `tests/inertia/admin_users.spec.ts`. Factory : `UserFactory.apply('platformAdmin')`.

## Roadmap

Découpage de la Phase 2 en 4 PR :

1. **PR 1 — Fondation données** — fait : migrations, modèles, types, seeder, tests.
2. **PR 2 — Profil fournisseur** — fait : service, validator, transformer, controller,
   routes, ability, écran `supplier/profile.vue`, i18n, tests.
3. **PR 3 — Onboarding** — fait : service, validator, controller, middleware
   `onboarded`, routes, écran + `base_radio_group`, i18n, tests.
4. **PR 4 — Annuaire public fournisseurs** (cette section) — fait : controller public, service,
   `SupplierDetailTransformer`, routes publiques, écrans `suppliers/{index,show}.vue` + cartes, i18n, tests.

**Hors code (ops)** : import en masse des ~300 fournisseurs (création/rattachement
d'organisations `supplier`, `suppliers.organization_id` renseigné).

Découpage séparé « gestion des organisations » (voir sections ci-dessus) :
PR1 (paramètres généraux), PR2 (membres existants) et PR3 (invitations par
email) faits — série complète ; PR4 (renvoi d'une invitation) et PR5 (purge des
invitations expirées) empilées dessus.

Découpage « cycle de vie de l'organisation » : PR 1 (socle backend, section
ci-dessus), **PR 2** (sélecteur + création) et **PR 3** (quitter + archiver)
faites — série complète.

**Restant sur le domaine organisations** (hors périmètre de ces PR) :

- ~~Fiabilité mail : `mail.sendLater()` s'appuie sur la file mémoire de
  `@adonisjs/mail` — une invitation est perdue si le process redémarre.~~ Fait
  (#33) : l'invitation passe par `SendMailJob` (queue `queue_jobs`, 5 retries,
  backoff exponentiel) — cf. `docs/mail.md`. Reste ouvert : **idempotence** (un
  rejeu après remise SMTP renvoie le mail — bénin pour une invitation, bloquant
  pour un devis) et **dead-letter / alerting** (aujourd'hui : log + rétention
  30 jours dans `queue_jobs`).
