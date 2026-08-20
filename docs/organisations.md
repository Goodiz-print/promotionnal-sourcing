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
- Gardé PostgreSQL (`tests/utils/database.ts` → `isPostgres()`) car il sème via
  `MainSeeder` (qui inclut le catalogue pgvector/tsvector) ; **sauté** sur SQLite.
  Résultat : pg → 32 passés ; sqlite → 19 passés, 13 sautés. Voir `docs/tests.md`.

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
  Construit sur un **kit de composants réutilisables** `inertia/components/base_*`
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
  `inertia/components/base_radio_group.vue` (cartes radio génériques) + i18n
  `resources/lang/{fr,en}/onboarding.json`.
- **Tests** : `tests/functional/onboarding.spec.ts` (redirection signup→onboarding, rendu écran,
  création org+owner+org courante, déjà-onboardé, gate middleware — SQLite, seed `RoleSeeder`) +
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

- **Migration** `…965_alter_organizations_add_logo_public_id` : `logo_public_id`
  nullable, même rôle que `product_images.public_id` (permet `destroy()` de
  l'ancien logo Cloudinary lors d'un remplacement).
- **Service** `app/services/organization_service.ts` : `update`, `updateLogo`
  (upload + suppression ancien asset), `removeLogo`. `CloudinaryService`
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
- **Tests** `tests/functional/organization_members.spec.ts` — **SQLite et
  Postgres** (aucune fonctionnalité catalogue requise ; seed direct
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
  et corrigé pendant ce PR, cf. `docs/changelog.md`).
- **Écrans** `inertia/pages/organization/invitation_{accept,invalid}.vue` +
  extension de `organization/members.vue` (nouveaux composants
  `inertia/components/organization/members/{invite_form,pending_invitations,members_table}.vue`).
  `auth/{login,signup}.vue` acceptent un prop `redirect` (+ `email` pour
  signup).
- **Tests** `tests/functional/organization_invitations.spec.ts` (8) et
  `organization_invitation_acceptance.spec.ts` (10, dont redirection post-
  auth) — SQLite et Postgres, `mail.fake()`. `tests/unit/safe_redirect.spec.ts`,
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
email) faits — série complète ; PR4 (renvoi d'une invitation) empilée dessus.

**Restant sur le domaine organisations** (hors périmètre de ces PR) :

- **Sélecteur d'organisation** — `currentOrganizationId` existe et le modèle est
  multi-organisation, mais aucun écran ne permet d'en changer. Conséquence : un
  invité qui a déjà une organisation accepte l'invitation (adhésion créée) sans
  pouvoir basculer dessus, `accept()` ne fixant l'org courante que si elle est
  absente.
- Quitter une organisation de sa propre initiative (seul le retrait par un
  admin existe), créer une organisation supplémentaire (l'onboarding ne se
  déclenche que sans org courante), supprimer/archiver une organisation.
- Purge des invitations expirées (le statut reste `pending` indéfiniment).
- Fiabilité mail : `mail.sendLater()` s'appuie sur la file mémoire de
  `@adonisjs/mail` — une invitation est perdue si le process redémarre.
