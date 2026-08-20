# Changelog

## 2026-08-20 — Cycle de vie de l'organisation : socle backend (PR 1/3)

Premier volet de la gestion du cycle de vie : créer une organisation
supplémentaire, la quitter, l'archiver. **Aucune UI dans cette PR** — routes et
écrans arrivent en PR 2 (sélecteur + création) et PR 3 (quitter/archiver).

- **Archivage réversible** — nouvelle colonne `organizations.archived_at`
  (migration `…968`). Jamais de suppression physique : `suppliers.organization_id`
  étant en `ON DELETE SET NULL`, un DELETE laisserait des fiches et des produits
  orphelins **encore publiés**. La restauration se fait en base (`archived_at` à
  `NULL`), aucun écran ne l'expose.
- **`OrganizationContextService`** (nouveau, sans dépendance) — contexte
  d'organisation de l'utilisateur : `currentFor`, `membershipsFor` (adhésions aux
  organisations vivantes), `fallbackFor`, `reassignCurrentOrganization`,
  `switchTo`, `ensureUsableOrganization`. Séparé d'`OrganizationService` pour
  éviter un cycle d'injection avec `OrganizationMembersService`.
- **`OrganizationService`** gagne `create` (transactionnelle, partagée avec
  l'onboarding qui n'en est plus que l'appelant), `leave` (même invariant
  « dernier owner » que le retrait par un admin) et `archive` (pose `archived_at`
  et **révoque les invitations en attente** — un lien en circulation ne doit pas
  faire rejoindre une organisation hors service).
- **`OnboardedMiddleware` durci** : au-delà de l'absence d'organisation courante,
  il détecte une organisation **archivée** ou une **adhésion disparue**, bascule
  silencieusement sur une autre organisation de l'utilisateur, et ne renvoie vers
  l'onboarding qu'en dernier recours. Même correction dans
  `OrganizationMembersService#removeMember`, qui remettait `currentOrganizationId`
  à `null` sans chercher de repli.
- **Catalogue public** : nouveaux scopes Lucid `Supplier.fromLiveOrganization` et
  `Product.fromLiveOrganization`, appliqués dans `SupplierDirectoryService` et
  `ProductCatalogueService`. Les fiches **sans** organisation (import en masse non
  rattaché, `organization_id` NULL) restent visibles — d'où `whereDoesntHave`
  plutôt qu'une jointure.
- **Acceptation d'invitation** : une invitation vers une organisation archivée
  n'est plus acceptable.
- **Nettoyage** : le helper `currentOrganization(user)` était **dupliqué mot pour
  mot dans 6 controllers**, avec une `Exception` inline `E_NO_CURRENT_ORG`
  contraire aux conventions. Remplacé par `OrganizationContextService#currentFor`
  et 3 vraies classes d'erreur (`NoCurrentOrganizationException`,
  `NotAMemberException`, `OrganizationArchivedException`).
- **Tests** : `tests/functional/organization_lifecycle.spec.ts` (11 tests).

## 2026-08-20 — Purge planifiée des invitations expirées

Les invitations d'organisation en attente restaient `pending` indéfiniment une
fois leur échéance passée : inacceptables côté acceptation, mais toujours
listées comme en attente. Un job quotidien fait le ménage.

- **Statut `expired`** ajouté à `INVITATION_STATUSES`
  (`shared/types/organization.ts`) et à la contrainte CHECK de
  `organization_invitations.status` (migration
  `…967_alter_organization_invitations_add_expired_status`, SQL brut : knex ne
  sait pas étendre l'énumération d'une colonne existante ; le `down()` remet les
  lignes `expired` en `pending`). Statut posé par la purge uniquement, jamais
  par une action utilisateur.
- **Service** `OrganizationInvitationsService#purgeExpired(now?)` → `{ expired,
deleted }` : bascule en `expired` les invitations `pending` échues (elles
  sortent de `listPending`, donc de l'écran membres), puis **supprime** les
  invitations en état terminal (`expired`/`revoked`) créées il y a plus de
  90 jours. Les invitations `accepted` ne sont jamais supprimées — elles tracent
  l'origine d'une adhésion active. `now` paramétrable pour tester la rétention.
- **Job** `app/jobs/purge_expired_invitations_job.ts` planifié dans
  `start/scheduler.ts` (cron `15 3 * * *` → tous les jours à **03:15 Europe/Paris**, id
  `purge-expired-invitations` pour une planification idempotente). Le service y
  est importé dynamiquement dans `execute()` : la queue charge les jobs au boot
  et ce service importe des modèles Lucid (même contrainte que
  `GenerateProductEmbeddingJob`).
- **Effet de bord assumé** : une invitation basculée `expired` n'est plus
  renvoyable (`resend` exige `pending`) — il faut ré-inviter l'email, sans
  risque de doublon. Avant passage du job, le bouton « Renvoyer » fonctionne
  comme avant.
- **Tests** : `tests/functional/organization_invitations.spec.ts` (+3). Docs
  `docs/organisations.md`.

## 2026-08-20 — Codegen AdonisJS partiellement sorti du versionnement

`.adonisjs/` contient **deux** familles de fichiers générés, qui n'ont pas le
même cycle de vie — seuls les premiers sont désormais ignorés par git (ils
l'étaient déjà par `.prettierignore`) :

- **Régénérés par `ace build` / `serve` / `test`** → ignorés :
  `client/data.d.ts`, `client/manifest.d.ts`, `server/{controllers,events,listeners,pages.d,policies}.ts`.
- **Produits par le seul `ace serve`** (tuyau, qui a besoin du routeur booté) →
  **restent versionnés** : `client/registry/{index.ts,schema.d.ts,tree.d.ts}` et
  `server/routes.d.ts`. La CI ne lance jamais le serveur : sans eux, `pnpm build`
  échoue (`inertia/client.ts` importe `@generated/registry`) et les pages SSR
  répondent 500 en test.

`database/schema.ts` reste lui aussi versionné bien que généré : sa regénération
(`node ace schema:generate`) exige une base de données, indisponible dans les
jobs CI `lint` et `build`, alors que tous les modèles l'importent.

## 2026-08-11 — Renvoi d'une invitation de membre

Complète les invitations par email : un owner/admin/manager peut **renvoyer** le
mail d'une invitation restée en attente (non reçue, lien expiré) depuis la liste
des invitations, sans en créer une seconde ni ressaisir l'email.

- **Route** `POST organization/invitations/:id/resend`
  (`organization.invitations.resend`), ability `canInviteMembers` — la même que
  l'envoi et la révocation.
- **Service** `OrganizationInvitationsService#resend` : prolonge `expires_at`
  d'un nouveau TTL (7 jours), précharge `role`/`invitedBy`, et laisse
  `invited_by_user_id` **inchangé** (renvoyer ≠ réinviter : le mail continue
  d'annoncer l'auteur d'origine). Une invitation `accepted`/`revoked` est
  refusée → `InvitationNotPendingException` (422,
  `app/exceptions/organization_errors.ts`), interceptée dans le controller →
  flash `error` + redirection, jamais de page d'erreur générique.
- **Lien** : nouveau lien signé (`signedUrlFor`, `expiresIn: '7d'`). Aucun token
  n'étant stocké en base, le lien précédent reste valide jusqu'à sa propre
  échéance ; la révocation demeure le moyen d'invalider immédiatement un lien en
  circulation (le statut est vérifié à l'acceptation).
- **Controller** : chargement de l'invitation factorisé en
  `findInOrganization(id, organizationId)`, partagé avec `destroy` — un id
  d'une autre organisation renvoie **404** (pas de fuite d'existence).
- **Écran** : bouton « Renvoyer » par ligne dans `pending_invitations.vue`
  (`router.post`, `preserveScroll`, sans `window.confirm` — action non
  destructive, contrairement à la révocation). i18n FR/EN
  `organization.invitations.{resend,resent,notPending}`.
- **Tests** : `tests/functional/organization_invitations.spec.ts` (+4 :
  prolongation de l'expiration et mail remis en file sans doublon, invitation
  révoquée refusée, invitation d'une autre organisation en 404, membre simple
  bloqué) et `tests/inertia/organization_members.spec.ts` (+1). Docs
  `docs/organisations.md`.

## 2026-07-17 — Invitations de membres par email (PR 3/3 gestion des organisations)

Dernier volet de la gestion des organisations : owner/admin/manager peuvent inviter
de nouveaux membres par email. L'invité clique le lien reçu, se connecte ou crée un
compte si besoin, puis rejoint l'organisation avec le rôle proposé.

- **Aucun token stocké en base.** Le lien d'invitation s'appuie sur le mécanisme
  natif d'URL signée d'AdonisJS v7 (`signedUrlFor`/`request.hasValidSignature`,
  `@adonisjs/core/services/url_builder`) — la signature encode elle-même
  l'expiration (7 jours), pas besoin de la vérifier manuellement. La table
  `organization_invitations` ne sert qu'à l'état métier (liste, révocation, rôle
  proposé, `expires_at` affiché) : `organization_id`, `email`, `role_id`,
  `invited_by_user_id`, `status` (`pending`/`accepted`/`revoked`), `expires_at`.
- **Service** `app/services/organization_invitations_service.ts` : `invite`
  (rejette si l'email est déjà membre — `AlreadyMemberException` — et rafraîchit
  une invitation en attente existante pour le même email plutôt que d'en
  dupliquer une), `revoke`, `findById`, `accept` (idempotent : ne duplique pas
  l'appartenance si déjà membre, fixe `currentOrganizationId` si absente).
- **Mail** `app/mails/organization_invitation_notification.ts` +
  `resources/views/emails/organization_invitation.edge`, envoyé via
  `mail.sendLater()` (file **interne** à `@adonisjs/mail`, en mémoire — ne
  survit pas à un redémarrage du process ; suffisant pour ce volume, à
  reconsidérer si la fiabilité de livraison devient critique). Aucune infra
  mail n'existait avant ce PR (`welcome_notification.ts` restait jusqu'ici
  non branché).
- **Controllers** :
  - `app/controllers/organization/invitations_controller.ts` (`store`/`destroy`,
    ability `canInviteMembers` — owner/admin/**manager**, déjà écrite en Phase 2,
    jamais branchée) : envoie le mail, gère la relance/révocation.
  - `app/controllers/organization/invitation_acceptance_controller.ts`
    (`show` **public**, `accept` **authentifié hors `onboarded`** — même
    exemption que `onboarding`/`logout`, cf. `start/routes.ts`) : la signature
    ne protège que l'aperçu public `show` (empêche l'énumération d'ids) ;
    `accept` s'appuie sur auth + email du compte connecté correspondant à
    l'email invité + statut `pending` non expiré — suffisant en soi, la
    signature n'est pas revérifiée côté bouton "Accepter" (le formulaire poste
    sur `acceptActionUrl`, l'URL exacte de la page chargée, jamais reconstruite
    via `urlFor` qui perdrait la signature).
  - `app/controllers/organization/members_controller.ts#index` étendu :
    précharge aussi les invitations en attente, expose `canManageMembers`
    (bool) en plus de `canInviteMembers` (désormais le gate de l'écran) — un
    manager voit l'écran et peut inviter, mais pas changer un rôle/retirer un
    membre (contrôles masqués côté écran en plus du 403 backend).
- **Redirection post-authentification** (`shared/helpers/safe_redirect.ts`,
  `isSafeRedirectPath`) : `session_controller.ts`/`new_account_controller.ts`
  lisent un paramètre `redirect` en query string (chemin `/<locale>/...`
  uniquement — jamais une URL absolue, anti open-redirect) pour ramener
  l'invité sur la page d'invitation après connexion/inscription ; `signup`
  préremplit aussi l'email invité. ⚠️ Le projet active `forwardQueryString:
true` par défaut sur tous les redirects (`config/app.ts`) — chaque redirect
  vers une cible dynamique doit explicitement `withQs(false)`, sinon la
  querystring de la requête courante (`?redirect=...`) se propage en boucle
  ou se retrouve dupliquée sur la destination (bug rencontré et corrigé ici).
- **Écrans** `inertia/pages/organization/invitation_{accept,invalid}.vue` +
  extension de `organization/members.vue` (formulaire d'invitation +
  liste des invitations en attente, nouveaux composants
  `inertia/components/organization/members/{invite_form,pending_invitations,members_table}.vue`).
  `auth/{login,signup}.vue` acceptent un prop `redirect` (et `email` pour
  signup) transmis en query string du POST.
- **Types** (`shared/types/organization.ts`) : `InvitationStatus`,
  `OrganizationInvitationType`, `OrganizationInvitationPreviewType`,
  `InviteMemberData`.
- **Tests** : `tests/functional/organization_invitations.spec.ts` (8 tests —
  invite, relance sans doublon, email déjà membre, manager autorisé/membre
  refusé, révocation, props écran membres) et
  `tests/functional/organization_invitation_acceptance.spec.ts` (10 tests —
  aperçu, signature invalide, invitation déjà traitée/expirée, acceptation,
  email non correspondant, redirection post-login/signup, y compris le
  paramètre `redirect` non sûr ignoré) — SQLite **et** Postgres, `mail.fake()`
  pour vérifier l'email mis en file sans réseau. `tests/unit/safe_redirect.spec.ts`.
  `tests/inertia/organization_invitation_accept.spec.ts` +
  `tests/inertia/organization_members.spec.ts` étendu.

Ce PR clôt la série « gestion des organisations » (3/3).

## 2026-07-17 — Gestion des membres de l'organisation (PR 2/3 gestion des organisations)

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

## 2026-07-17 — Paramètres généraux de l'organisation (PR 1/3 gestion des organisations)

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

## 2026-07-13 — Intégration du design system (artéfact claude.ai/design)

Intègre l'artéfact **« Promotional Sourcing Design System »** au frontend :
les tokens de design deviennent la source de vérité des styles.

- **Tokens** (`inertia/css/tokens/`) : `colors.css` (rampe marque **indigo**
  #4032c8 échantillonnée sur le logo + rampe neutre **ink** teintée navy +
  sémantique surfaces/texte/bordures/états/boutons), `typography.css` (échelle
  display/heading/body/eyebrow/tabular, fonte **Inter** substitut de Sohne),
  `spacing.css` (grille 8px, radius, ombres navy, motion, layout).
- **`app.css`** : importe les tokens, les expose à Tailwind v4 via `@theme`
  (utilitaires `bg-indigo-*`, `text-ink-*`, `text-primary`, `shadow-1/2/3`,
  `font-sans` Inter…) et ajoute des utilitaires typographiques `type-*`
  (`type-display-xl`, `type-heading-lg`, `type-body-md`, `type-eyebrow`…).
- **Rétro-compatibilité** : les variables historiques (`--gray-*`, `--primary-*`,
  `--color-primary*`) utilisées par les composants Vue existants sont conservées
  et repointées sur la rampe du design system → adoption sans modifier les
  composants (neutres désormais teintés navy, indigo de marque exact).
- **`inertia_layout.edge`** : chargement de la police Inter/IBM Plex Mono
  (Google Fonts, `preconnect`).

## 2026-07-11 — Injection de dépendances (conteneur IoC AdonisJS)

Adopte l'**injection de dépendances** partout : plus de `new Service()` dans les
controllers/services/jobs/commands (retour de revue). Règle ajoutée à `CLAUDE.md`.

- **Controllers** décorés `@inject()` avec dépendances par **constructeur** (le
  routeur les résout via le conteneur) : `products`, `suppliers`, `onboarding`,
  `admin/category`, `supplier/{profile,product}`.
- **Services** : `EmbeddingService` et `SupplierProductService` en `@inject()`
  (dépendances injectées, plus de `new` par défaut).
- **Abstraction IA** : `EmbeddingProvider` devient une **classe abstraite**
  (token IoC) ; le service provider `providers/ai_provider.ts` lie le driver
  choisi par `AI_PROVIDER` (`container.singleton`) via `provider_registry.ts`
  (`embeddingProviderFor`). `EmbeddingService` injecte l'abstraction.
- **Jobs / commands** résolvent via `app.container.make(...)` (plus de `new`).
- Règle DI documentée dans `CLAUDE.md` (+ « Ne jamais faire »).

## 2026-07-11 — Embeddings multi-provider (abstraction IA)

Rend la recherche sémantique **provider-agnostique** : le driver d'embeddings
est choisi par `AI_PROVIDER`, Mistral n'étant plus qu'un driver parmi d'autres.

- **Abstraction** : interface `EmbeddingProvider` (`shared/types/ai.ts`) +
  factory `app/services/embeddings/provider_factory.ts` (résout selon
  `AI_PROVIDER`). Exceptions `app/exceptions/ai_errors.ts`
  (`UnknownAiProviderError`, `EmbeddingProviderError`, `EmbeddingDimensionError`).
- **Drivers** : `mistral_provider.ts` (SDK natif, `outputDimension`) et
  `openai_compatible_provider.ts` (générique HTTP `/embeddings`, `fetch` injecté)
  couvrant OpenAI, Together, Groq, Ollama, vLLM, LM Studio… via `AI_BASE_URL` /
  `AI_API_KEY` / `AI_EMBED_MODEL`.
- **`EmbeddingService`** délègue désormais au provider injecté et **valide la
  dimension** (figée à 1024 = colonne `products.embedding`) → un provider ne
  sachant pas produire 1024 dims est rejeté explicitement.
- **Config/env** : `config/ai.ts` (provider + config par driver), env
  `AI_PROVIDER`, `AI_BASE_URL`, `AI_API_KEY`, `AI_EMBED_MODEL`,
  `MISTRAL_EMBED_MODEL` (toutes optionnelles). `.env.example` documenté.
- **Tests** : `tests/unit/embedding_service.spec.ts` étendu (service + fake
  provider, driver Mistral mocké, driver OpenAI-compatible avec `fetch` mocké,
  factory) — zéro appel réseau. Docs `catalogue.md`.

## 2026-07-11 — Recherche sémantique : embeddings Mistral (Phase 1)

Ajoute la génération d'**embeddings produits via Mistral** et la **recherche
sémantique** du catalogue (plus proches voisins pgvector), en complément du
full-text existant. Clôt le volet « recherche sémantique » de la Phase 1 (#20,
suivi de #2, coordonné avec #7).

- **Config** `config/ai.ts` (Mistral `mistral-embed`, 1024 dims) + env
  `MISTRAL_API_KEY` (optionnel) et `AI_EMBEDDINGS_ENABLED` (bool, **défaut
  faux**). Désactivé en dev/test/CI → **aucun appel réseau** ; activé en prod.
- **Service** `embedding_service.ts` : `embed(text)` (client Mistral injecté →
  testable), `embedAndStore(product)` (persiste `products.embedding` en
  `?::vector`), `productText(product)` (nom + description, toutes locales).
  Helper `shared/helpers/pgvector.ts` (`toPgVector`).
- **Job** `app/jobs/generate_product_embedding_job.ts` (alias `#jobs/*`) :
  dispatché à la création/mise à jour d'un produit fournisseur
  (`supplier_product_service`, dispatch résilient). No-op tant que l'IA est
  désactivée.
- **Recherche** : `product_catalogue_service.list` accepte un `queryEmbedding`
  optionnel → tri par distance cosinus (`embedding <=> ?::vector`, index HNSW)
  parmi les produits vectorisés ; repli automatique sur le full-text si l'IA est
  indisponible. `products_controller` calcule l'embedding de la requête
  (best-effort) quand l'IA est active.
- **Backfill** : commande `node ace embeddings:backfill` (embeddings manquants).
- **Tests** : `tests/unit/embedding_service.spec.ts` (Mistral mocké, zéro
  réseau) + `tests/functional/product_embeddings.spec.ts` (tri sémantique +
  repli FTS, gardés Postgres/pgvector).
- **Docs** : `docs/catalogue.md` (section « Recherche sémantique »).

## 2026-07-11 — Administration des catégories (CRUD taxonomie) — Phase 1

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

## 2026-07-11 — Fournisseur : CRUD produits + upload d'images (Phase 1)

Donne au fournisseur l'écran authentifié pour créer / éditer / supprimer ses
produits, avec upload multi-images branché sur Cloudinary. Consomme l'infra #17
et fait avancer #2.

- **Routes** (`:locale`, `auth` + `onboarded`) : `supplier.products.index/create/store/edit/update/destroy`
  (`update` en **POST** pour porter le multipart).
- **Ability** `canManageProducts` (org `supplier`/`both` + `owner`/`admin`).
- **Service** `supplier_product_service.ts` : `resolveSupplier` (**get-or-create** du
  fournisseur de l'org), `create`/`update`/`delete`, slug unique, traductions par locale,
  facettes en ET fiable (`attributeValues.sync`), galerie (upload/suppression Cloudinary,
  `image_url` recalé). `CloudinaryService` injecté (testable). `findOwned` garantit l'ownership.
- **Validateur** `supplier_product.ts` (contenu bilingue requis, facettes, `vine.file` multi,
  `removedImageIds`). **Transformer** `product_edit_transformer.ts` (`ProductEditType`).
- **Frontend** : pages `supplier/products/{index,create,edit}` + formulaire partagé
  `products/form/product_form.vue` (sections reliées par provide/inject) + composant
  générique `base_file_input.vue` ; i18n `products.manage.*`.
- **Tests** : `supplier_products.spec.ts` (CRUD, ownership 404, acheteur 403, publication
  au catalogue), `supplier_product_images.spec.ts` (galerie + get-or-create, Cloudinary
  mocké), `tests/inertia/supplier_products.spec.ts` (liste, file input, facettes).
- **Docs** : `docs/catalogue.md` (section « Gestion produit fournisseur »).

## 2026-07-11 — Infra : upload Cloudinary multi-fichiers + galerie d'images produit

Pose l'intégration **Cloudinary** (jusque-là inexistante) comme brique d'upload
réutilisable **multi-fichiers**, et l'applique à une **galerie d'images produit**.
(Issue #17.) L'écran d'upload fournisseur suivra avec le CRUD produit (#2).

- **Cloudinary** : dépendance `cloudinary`, `config/cloudinary.ts`, env
  `CLOUDINARY_*` **validées** (`start/env.ts`) + `.env.example`. Service
  `app/services/cloudinary_service.ts` : `upload`/`uploadMany` (galerie) +
  `destroy`/`destroyMany` (nettoyage des assets). **Dossier imposé**
  `promotionnal-sourcing/<environnement>/…` (`NODE_ENV`). Exception
  `app/exceptions/upload_errors.ts` (`CloudinaryUploadException`).
- **Modèle galerie** : migration `create_product_images_table` (`product_id`
  CASCADE, `secure_url`, `public_id` unique, `position`, `width`/`height`) ;
  modèle `product_image.ts` (`Product hasMany images`). `products.image_url`
  conservé comme image principale dénormalisée.
- **Types & transformers** : `ProductImageType` (en `type`), `ProductDetailType.images` ;
  `ProductImageTransformer` ; `ProductDetailTransformer` + `findBySlug` préchargent
  et exposent les images triées par `position`.
- **Validateur multi-fichiers** réutilisable `app/validators/product_image.ts`
  (`vine.array(vine.file(...))`, jpg/png/webp, 5 Mo, max 8).
- **Frontend** : `inertia/components/product_gallery.vue` (image principale +
  miniatures, repli sur `imageUrl`) intégré à `products/show.vue` ; clé i18n
  `products.show.viewImage`.
- **Docs** : `CLAUDE.md` (section Cloudinary ; Ghostscript/PDF marqué non implémenté),
  `docs/catalogue.md` (section « Images produit »).
- **Tests** : `tests/unit/cloudinary_service.spec.ts` (uploader mocké, zéro réseau),
  `tests/functional/product_images.spec.ts` (galerie triée via HTTP),
  `tests/inertia/products.spec.ts` (`product_gallery.vue`).

## 2026-07-11 — Phase 1 : catalogue public produits (recherche puissante, lecture)

Expose publiquement (sans auth) le catalogue produits : liste filtrable +
fiche détaillée, avec une **recherche full-text locale-aware** et le
**filtrage à facettes en ET fiable**. Première tranche applicative de l'issue #2
(la couche données EAV/i18n existait déjà) ; le CRUD fournisseur et les
embeddings Mistral restent à faire.

- **Routes publiques** (`:locale`, hors auth) : `GET /products` (`products.index`),
  `GET /products/:slug` (`products.show`).
- **Service** `product_catalogue_service.ts` : liste paginée + filtres. Recherche
  **FTS PostgreSQL** locale-aware via `product_translations.search_vector`
  (`websearch_to_tsquery(<config locale>, …)`, `LOCALE_TSCONFIG`) ; filtre
  catégorie et made-in-Europe ; **facettes attributs en ET fiable** (un `whereHas`
  par valeur → combinaison `AND`). `findBySlug` (fournisseur/catégorie/facettes
  préchargés), `availableCategories`, `filterableAttributes`.
- **Controller** `products_controller.ts` (public) ; **exception**
  `app/exceptions/catalogue_errors.ts` (`ProductNotFoundException` → 404).
- **Transformer** `ProductDetailTransformer` (produit, résumé fournisseur/catégorie,
  facettes résolues). `CategoryTransformer`/`AttributeTransformer`/
  `AttributeValueTransformer` rendus **Inertia-safe** (retour typé, dates ISO) ;
  `CategoryType`/`AttributeType`/`AttributeValueType`/`AttributeWithValuesType`
  passés d'`interface` à `type` (contrainte props Inertia `Record<string, JSON>`).
- **Types partagés** : `ProductDirectoryFilters`, `ProductCatalogueFacets`,
  `ProductDetailType`, `ProductDetailAttributeType` (`shared/types/product.ts`).
- **Frontend** : `inertia/pages/products/{index,show}.vue` + composants
  `catalogue_filters.vue` (recherche debouncée, select catégorie, toggle
  made-in-Europe, cases à cocher facettes) et générique `base_checkbox.vue` ;
  réutilise `product_card.vue`. i18n `resources/lang/{fr,en}/products.json`.
- **Tests** : `tests/functional/products_directory.spec.ts` (FTS FR/EN, filtres,
  ET fiable via HTTP, fiche, 404) + `tests/inertia/products.spec.ts`.

## 2026-07-10 — Phase 2 (PR 4/4) : annuaire public fournisseurs

Expose publiquement (sans auth) le catalogue des fournisseurs : liste
filtrable + fiche détaillée (profil fournisseur + catalogue produits). Clôt
la Phase 2.

- **Routes publiques** (`:locale`, hors auth) : `GET /suppliers` (`suppliers.index`),
  `GET /suppliers/:slug` (`suppliers.show`).
- **Controller** `suppliers_controller.ts` (public) + **service**
  `supplier_directory_service.ts` : liste paginée, filtre **pays**, recherche par
  **nom localisé** (`whereHas('translations').whereILike`) ; fiche avec preload
  `products` + `organization.supplierProfile` ; 404 si introuvable.
- **Transformer** `SupplierDetailTransformer` (fiche = supplier + profil + produits).
  `SupplierTransformer`/`ProductTransformer` rendus **Inertia-safe** (retour typé,
  dates en ISO) ; `SupplierType`/`ProductType` passés d'`interface` à `type`
  (contrainte props Inertia). Types `SupplierDetailType`, `SupplierDirectoryFilters`,
  `Paginated<T>`/`PaginationMeta` (nouveau `shared/types/pagination.ts`).
- **Frontend** : `inertia/pages/suppliers/{index,show}.vue` + composants réutilisables
  `supplier_card.vue` / `product_card.vue` ; filtres via `router.get` (preserveState,
  debounce) ; i18n `resources/lang/{fr,en}/suppliers.json`.
- **Tests** : `tests/functional/suppliers_directory.spec.ts` (7 cas) +
  `tests/inertia/suppliers.spec.ts`. Résultat : pg → 50 passés ; sqlite → 26 passés,
  24 sautés ; Vitest → 25.
- **Doc** : `docs/organisations.md` (section « Annuaire public »).

## 2026-07-10 — Phase 2 (PR 3/4) : onboarding acheteur/fournisseur

Le signup ne crée qu'un `User` (sans organisation) : l'onboarding crée la
**première organisation** de l'utilisateur et fixe son type. Signal « à
onboarder » = `currentOrganizationId == null` (aucun flag/migration DB).

- **Flux** : signup / login sans organisation courante → redirection vers
  `onboarding.show`. L'écran demande le **nom d'organisation** + le **type**
  (acheteur/fournisseur) ; le `POST` crée l'`Organization` (slug dérivé du nom),
  rattache l'utilisateur en **`owner`**, fixe `currentOrganizationId`, redirige à l'accueil.
- **Routes** (`:locale` + `auth`) : `GET/POST /onboarding` (`onboarding.show` / `onboarding.store`).
- **Middleware** `onboarded` (`app/middleware/onboarded_middleware.ts`, nommé dans
  `start/kernel.ts`) : redirige les utilisateurs org-less accédant à un écran nécessitant une
  organisation (ex. `supplier/profile`) vers l'onboarding. `new_account`/`session` controllers
  redirigent vers l'onboarding après auth si pas d'org.
- **Backend** : service `onboarding_service.ts` (`completeOnboarding`, slug unique via
  `stringHelpers.slug`), validator `onboarding.ts` (`ONBOARDING_TYPES` = buyer/supplier),
  type partagé `OnboardingData`/`OnboardingKind`.
- **Frontend** : `inertia/pages/onboarding/index.vue` (`useForm`) + nouveau composant réutilisable
  `inertia/components/base_radio_group.vue` (cartes radio génériques) + i18n
  `resources/lang/{fr,en}/onboarding.json`.
- **Tests** : `tests/functional/onboarding.spec.ts` (5 cas : redirection signup, rendu, création
  org+owner+org courante, déjà-onboardé, gate middleware — SQLite/`RoleSeeder`) ;
  `tests/inertia/onboarding.spec.ts` + `base_radio_group` ; `auth.spec.ts` adapté (redirection
  signup/login → onboarding). Résultat : functional sqlite → 26 passés, 17 sautés ; Vitest → 20.
- **Doc** : `docs/organisations.md` (section « Onboarding »).

## 2026-07-10 — Phase 2 (PR 2/4) : profil fournisseur (CRUD + écran)

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

## 2026-07-10 — Phase 2 (PR 1/4) : fondation données organisations acheteur/fournisseur

Socle **données** de la Phase 2 (#3), non destructif. Introduit le type
d'organisation, le profil fournisseur, et **réconcilie** la table `suppliers`
(catalogue #2, jusqu'ici autonome) avec les `organizations`. Aucune route ni
écran — c'est la première PR du découpage en 4 (PR 2 : CRUD profil + écran
fournisseur ; PR 3 : onboarding acheteur/fournisseur ; PR 4 : annuaire public).

- **Migrations** :
  - `alter_organizations_add_type` : colonne `organization_type` enum(`buyer`,
    `supplier`, `both`), `notNullable`, défaut `buyer`.
  - `alter_suppliers_add_organization_id` : FK `suppliers.organization_id`
    nullable → `organizations` (`onDelete SET NULL`). **Cardinalité hasMany**
    (pas de contrainte unique) : une organisation peut porter plusieurs fiches.
  - `create_supplier_profiles_table` : `organization_id` unique (un profil par
    organisation, `onDelete CASCADE`), `min_order_quantity`, `delivery_days`,
    `delivery_scope` enum(`national`,`europe`,`worldwide`), `certifications`
    (`text[]`, aligné sur `synonyms`), `bio`, `response_time_days`.
- **Modèles** : `SupplierProfile` (`belongsTo(Organization)`) ; `Organization`
  gagne `hasOne(SupplierProfile)`, `hasMany(Supplier)` et l'override
  `organizationType: OrganizationKind` ; `Supplier` gagne `belongsTo(Organization)`.
- **Types partagés** (`shared/types/organization.ts`) : `ORGANIZATION_TYPES` /
  `OrganizationKind` / `DEFAULT_ORGANIZATION_KIND`, `DELIVERY_SCOPES` /
  `DeliveryScope`, champ `organizationType` sur `OrganizationType`, nouvelle
  interface `SupplierProfileType`. (`OrganizationKind` nommé ainsi pour ne pas
  entrer en collision avec l'interface `OrganizationType` existante.)
- **Transformer** : `OrganizationTransformer` expose `organizationType`.
- **Seeders** : `DevUserSeeder` crée une 2ᵉ organisation `eurogoods-org` de type
  `supplier` (dev user en `owner`) + son `SupplierProfile` ; l'org de démo
  passe en `buyer`. `SupplierSeeder` rattache la fiche `eurogoods` à cette
  organisation fournisseur.
- **Schéma généré** : `database/schema.ts` régénéré (Postgres) avec
  `SupplierProfileSchema`, `organizations.organization_type`,
  `suppliers.organization_id`.
- **Tests** : `tests/functional/organization_supplier.spec.ts` (gardé Postgres) —
  type d'org, profil détaillé, rattachement fiche↔org (belongsTo + hasMany),
  sortie du transformer. Suites : pg → 32 passés ; sqlite → 19 passés, 13 sautés.
- **Doc** : `docs/organisations.md` (doc dédiée : modèle de données, relations,
  types, seeders, roadmap 4 PR) + cross-link depuis `docs/catalogue.md`.

## 2026-07-10 — Doc dédiée catalogue

Ajout de `docs/catalogue.md`, absent malgré les entrées de changelog
détaillées : modèle de données (tables, mécanisme du `ET` via
`product_attributes`), vectorisation/full-text PostgreSQL (`pgvector`,
`search_vector` par langue), i18n du contenu catalogue, fichiers clés par
domaine, tests, roadmap (incrément 3 : moteur de recherche + embeddings
Mistral).

## 2026-07-10 — Suite de tests (catalogue + i18n)

Couverture automatisée de l'existant avant le moteur de recherche. Les tests catalogue s'appuient sur PostgreSQL (pgvector/tsvector) et sont gardés par dialecte.

- **Garde de dialecte** (`tests/utils/database.ts`) : `isPostgres()` ; les groupes catalogue s'exécutent sous Postgres (CI + `DB_CONNECTION=pg`) et sont **sautés** sur SQLite (aucune migration lancée → pas de casse locale).
- **`tests/functional/catalogue.spec.ts`** : sanity du seed (6 produits, 12 traductions), **transformers localisés** (`new ProductTransformer(p, 'en').toObject().name` → anglais ; `AttributeValueTransformer` → `Blue`/`Bleu`), et **filtrage `ET`** via les relations réelles (`whereHas('category')` + `whereHas('attributeValues')` → uniquement les 2 crayons bleus).
- **`tests/functional/catalogue_fts.spec.ts`** : **FTS par langue** (`to_tsquery('english','watercolor')` → ligne EN ; `to_tsquery('french','aquarelle')` → ligne FR ; contrôle croisé), et `products.embedding` présent/NULL.
- **`tests/functional/i18n.spec.ts`** enrichi : rendu localisé `/fr/login` (« Se connecter ») et `/en/login` (« Password »), persistance de la locale dans le cookie en visitant `/en`.
- **Semis en test** via `MainSeeder` directement (ordre des dépendances) plutôt que `db:seed` (qui exécute aussi chaque seeder isolément → `dev_user` avant les rôles → échec sur base vierge). Cleanup par `testUtils.db().truncate()`.
- **Doc** : `docs/tests.md` mis à jour (plugins réels, base Postgres pour le catalogue, pattern de garde de dialecte).
- **Résultat** : SQLite → 16 passés + 8 sautés (catalogue) ; PostgreSQL → 24 passés ; Vitest → 6.

## 2026-07-10 — i18n du contenu catalogue (multilingue, N langues)

Le **contenu** du catalogue devient multilingue (FR/EN, extensible à N langues), dans le modèle **et** la recherche. Tout le texte quitte les tables de base pour des **tables de traduction dédiées** ; les tables de base ne gardent que le neutre (ids, slugs, `value` canonique, `unit`, `synonyms`, prix, flags, `embedding`).

- **Tables de traduction** (migrations `…955`→`…959`) : `supplier_translations`, `category_translations`, `attribute_translations`, `attribute_value_translations`, `product_translations` — colonnes `<entity>_id` + `locale` + champs traduits (name/description, name, label), `unique(<entity>_id, locale)`.
- **FTS par langue** : `product_translations.search_vector` = colonne générée **immuable** via un `CASE` par locale (`french`/`english`/… sinon `simple`) + index GIN. Recherche plein-texte dans la bonne langue (`to_tsquery('english', …)` vs `to_tsquery('french', …)`).
- **Retrait du texte des tables de base** (migration `…960`) : drop de `name`/`description`/`label` (et de l'ancienne colonne générée FR `products.search_vector`). `down()` réversible best-effort.
- **`schema_rules.ts`** : `products.skipColumns=['embedding']`, `product_translations.skipColumns=['search_vector']`.
- **Config N langues** : `LOCALE_TSCONFIG` (`shared/types/i18n.ts`) mappe locale→config FTS (défaut `simple`) ; ajouter une langue = une entrée ici + une branche `WHEN` dans la migration.
- **Modèles** : `*_translation.ts` (belongsTo parent) + relation `@hasMany(() => XxxTranslation) translations` sur les 5 modèles de base.
- **Résolution localisée** : helper `shared/helpers/translations.ts` (`resolveTranslation(translations, locale, fallback=fr)`), réutilisé par les transformers.
- **Transformers locale-aware** : constructeur `(resource, locale)` ; `Xxx.transform(resource, ctx.i18n.locale)` sort `name`/`description`/`label` résolus (repli FR).
- **Types partagés** : `XxxTranslationType` ; `CreateXxxData` déplace les champs traduits dans `translations: Partial<Record<Locale, {…}>>`.
- **Seeders** : contenu de démo bilingue FR/EN (produits, catégories, attributs + valeurs, fournisseurs).
- **Tests** : `tests/unit/translations.spec.ts` (résolution + repli). Preuve SQL : contenu EN/FR, FTS par langue (`watercolor`→EN, `aquarelle`→FR), et le filtrage `ET` neutre inchangé (crayon+bleu → 2 crayons bleus).
- **À suivre (incrément 3)** : les validateurs `create/update` et les endpoints d'écriture seront adaptés au payload `translations` ; moteur de recherche locale-aware + embeddings Mistral + page Inertia consommant ces traductions.

## 2026-07-08 — i18n : sélection de la langue par préfixe d'URL (/fr, /en)

Ajout d'un routing localisé par **préfixe d'URL** au-dessus du socle i18n existant (PR #10), pour un meilleur SEO (URLs distinctes indexables par langue, cohérent avec le SSR). Le moteur i18n de #10 (formatage ICU via `intl-messageformat`, types partagés, `translations`/`supportedLocales` en props, messages de validation traduits, persistance cookie + `users.locale`) est **conservé** ; seule la couche de sélection de langue évolue.

- **Routing** (`start/routes.ts`) : les routes applicatives passent sous un groupe `.prefix(':locale').where('locale', /^(fr|en)$/)` ; la racine `/` **redirige** vers la locale résolue ; une locale non supportée (`/de/…`) renvoie 404. `POST /locale` reste hors préfixe.
- **Priorité de détection** (`app/middleware/detect_user_locale_middleware.ts`) : **préfixe d'URL** > cookie > `users.locale` > `Accept-Language` > défaut. La locale issue de l'URL est mémorisée dans le cookie signé (la racine se souvient de la dernière langue visitée).
- **Changement de langue** (`app/controllers/locale_controller.ts`) : `POST /locale` persiste le choix (cookie + utilisateur) puis **redirige vers l'URL préfixée** de la nouvelle langue (segment de locale reconstruit depuis le `referer`).
- **Liens/formulaires localisés** : `:params="{ locale }"` sur les `<Link>`/`<Form>` nommés (layout, login, signup) ; redirections contrôleurs `toRoute(..., { locale })`.
- **Tests** (`tests/functional/i18n.spec.ts`) : redirection racine, `Accept-Language`, rendu `/fr` & `/en`, 404 locale invalide, `POST /locale` → URL préfixée + cookie, rejet locale non supportée.
- **Note** : deux migrations partagent le préfixe `…948` (`alter_users_add_locale` de #10 et `enable_search_extensions` du catalogue) — sans impact (noms uniques, tri déterministe), à renuméroter lors d'un prochain reset de migrations si souhaité.

## 2026-07-03 — Modèle de données catalogue (prêt pour la recherche hybride)

Mise en place du socle catalogue (fournisseurs, catégories, attributs, produits) **conçu dès le départ pour la recherche multi-critères fiable** (le « crayon de couleur bleu → uniquement des crayons bleus »). Ce livrable pose uniquement le modèle de données ; le service d'embeddings, le moteur de recherche et le parseur de requête arriveront dans un prochain incrément.

- **Extensions PostgreSQL** (`database/migrations/…948_enable_search_extensions.ts`) : `vector` (pgvector), `pg_trgm` (recherche floue), `unaccent` (normalisation FR côté requête). Migration no-op hors PostgreSQL.
- **Tables créées** :
  - `suppliers` — fournisseur européen (nom, slug, pays ISO2, contact, `is_active`)
  - `categories` — taxonomie auto-référencée (`parent_id` SET NULL) + `synonyms text[]` pour le futur parseur
  - `attributes` — définitions de facettes (`slug`, `type` enum `string|number|boolean|enum`, `unit`, `is_filterable`)
  - `attribute_values` — valeurs énumérées (`value` canonique, `label`, `slug`, `synonyms text[]`), unique `(attribute_id, slug)`
  - `products` — cœur du catalogue (FK `supplier_id` CASCADE, `category_id` RESTRICT, prix, MOQ, `origin_country`, `made_in_europe`)
  - `product_attributes` — pivot facettes (**le mécanisme du ET fiable**) : `(product_id, attribute_id, attribute_value_id)` + `value_number`/`value_string`, unique `(product_id, attribute_id, attribute_value_id)`
- **Vectorisation & full-text** sur `products` :
  - `embedding vector(1024)` (nullable) + index **HNSW** `vector_cosine_ops` — prêt pour `mistral-embed` (peuplé par un futur job)
  - `search_vector tsvector` en **colonne générée immuable** `to_tsvector('french', name || description)` + index **GIN** (`unaccent` reste appliqué côté requête, car STABLE et interdit dans une colonne GENERATED)
  - Index btree sur `supplier_id`, `category_id`, `origin_country`, `is_active`
- **Schéma généré** (`database/schema_rules.ts`) : `embedding`/`search_vector` exclus du schéma ORM (`skipColumns`, gérés en SQL brut, jamais sérialisés). Wiring du fichier de règles via `config/database.ts` (`schemaGeneration.rulesPaths`).
- **Modèles** (`app/models/`) : `supplier`, `category` (self-ref + enfants), `attribute`, `attribute_value`, `product` (belongsTo supplier/category, manyToMany `attributeValues` via le pivot), `product_attribute`.
- **Types partagés** (`shared/types/`) : `supplier.ts`, `category.ts`, `attribute.ts`, `product.ts` (`XxxType` + `CreateXxxData`/`UpdateXxxData`).
- **Validateurs** (`app/validators/`) et **transformers** (`app/transformers/`) create/update pour chaque ressource ; `ProductTransformer` n'expose jamais `embedding`/`searchVector`.
- **Seeders de démo** (`database/seeders/`, enregistrés dans `main_seeder.ts`) : 3 fournisseurs, catégories crayon/stylo/sac, attributs couleur/matière, et 6 produits (dont 2 crayons bleus, 1 crayon rouge, 1 stylo bleu, 1 sac bleu) prouvant le filtrage : `category=crayon ET color=blue` ⇒ **uniquement les 2 crayons bleus**.
- **Infra** : image Docker `pgvector/pgvector:pg18` (dev + test + CI). En test, `DB_CONNECTION=pg` bascule la connexion sur PostgreSQL (SQLite ne supporte ni pgvector ni tsvector) ; `.env.example` complété avec les variables `DB_*`.

## 2026-07-03 — Charte graphique : couleurs de marque et favicon

Mise en place de la charte graphique du site, alignée sur le logo (violet `#4032C8` / RGB `64, 50, 200`, fond dominant blanc, violet réservé à l'accent — boutons et rappels), inspirée de la sobriété de [stripe.com](https://stripe.com/en-fr).

- **`inertia/css/app.css`** :
  - Ajout des variables de marque `--primary-1` à `--primary-11` + `--color-primary-contrast` dans `:root`
  - Ajout d'un bloc `@theme` Tailwind v4 exposant `--color-primary`, `--color-primary-hover`, `--color-primary-1/3/6/9/10/11`, `--color-primary-contrast` (utilisables via `bg-primary`, `text-primary`, etc.)
  - `button` et `.hero .button` passent du gris/noir au violet de marque (fond `--color-primary`, hover `--color-primary-hover`)
  - Ajout d'un anneau de focus visible violet (`--primary-6`) sur boutons, liens, champs de formulaire
- **`public/favicon.svg`, `public/favicon.png`** : copiés depuis `inertia/assets/` pour être servis statiquement (provider `@adonisjs/static`, déjà actif)
- **`resources/views/inertia_layout.edge`** : ajout des balises `<link rel="icon">` (SVG + PNG), `<meta name="theme-color" content="#4032c8">`, et titre par défaut `promotionalsourcing.eu` (au lieu du placeholder `AdonisJS`)
- **`docs/charte-graphique.md`** : documentation complète de la charte (logo, couleurs avec hex/RGB, règles d'usage du violet, typographie, composants, favicon)
- **Comportement notable** : le violet reste un accent — pas de fond de page ni de navigation en violet, uniquement CTA/boutons/focus/rappels ; les couleurs sémantiques (succès/erreur) restent inchangées

## 2026-06-27 — Activation du SSR (Server-Side Rendering)

Activation du rendu côté serveur via Inertia.js + Vue 3 SSR pour améliorer le SEO et les performances de la marketplace.

- **`config/inertia.ts`** : `ssr.enabled` passé à `true`
- **`vite.config.ts`** : `ssr.enabled` passé à `true` dans le plugin Inertia
- **`inertia/app.ts`** : `createApp` remplacé par `createSSRApp` pour l'hydratation côté client
- **`inertia/ssr.ts`** : déjà configuré correctement (`createSSRApp` + `renderToString`)
- **Build SSR** : `node ace build` génère le bundle SSR ; en dev `node ace serve --hmr` supporte le SSR à chaud
- **À surveiller** : tout accès à `window` / `document` doit être dans `onMounted` ou un guard `typeof window !== 'undefined'`

## 2026-06-26 — Entités de base : Organisation, Rôles, Permissions

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

## 2026-06-26 — Système de mail (@adonisjs/mail)

Installation et configuration de `@adonisjs/mail` avec le transport SMTP.

- **Package** : `@adonisjs/mail@10.3.0`
- **Fichiers ajoutés** :
  - `config/mail.ts` — configuration SMTP avec auth conditionnelle (désactivée si `SMTP_USERNAME` vide, pour Mailpit)
  - `app/mails/welcome_notification.ts` — mail de bienvenue post-inscription
  - `resources/views/emails/welcome.edge` — template Edge du mail de bienvenue
  - `docs/mail.md`
- **`adonisrc.ts`** : ajout du provider `@adonisjs/mail/mail_provider` et des commandes `@adonisjs/mail/commands`
- **`start/env.ts`** : ajout des variables `SMTP_*`, `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`
- **Comportement notable** :
  - Auth SMTP désactivée automatiquement si `SMTP_USERNAME` est vide (compatible Mailpit en local)
  - `globals` Edge disponibles dans tous les templates : `brandName`, `appUrl`
  - Envoi en queue : `await mail.sendLater(new WelcomeNotification(user))`
- **En dev** : Mailpit (`brew install mailpit`) — interface sur http://localhost:8025
- **Doc** : [docs/mail.md](./mail.md)

## 2026-06-26 — Système d'événements (Emitter)

Configuration du système d'événements AdonisJS (`@adonisjs/core/services/emitter`) avec listeners lazy-loaded.

- **Fichiers ajoutés** :
  - `app/events/user_registered.ts` — event émis à l'inscription d'un utilisateur
  - `app/events/user_logged_in.ts` — event émis à la connexion d'un utilisateur
  - `app/listeners/on_user_registered.ts` — listener associé à `UserRegistered`
  - `app/listeners/on_user_logged_in.ts` — listener associé à `UserLoggedIn`
  - `start/events.ts` — enregistrement des bindings event → listener
- **`adonisrc.ts`** : ajout du preload `#start/events`
- **Comportement notable** :
  - Les listeners sont lazy-loaded (import dynamique) — aucun impact sur le démarrage
  - Pour émettre : `await emitter.emit(UserRegistered, new UserRegistered(user))`
  - Pour ajouter un event : classe dans `app/events/`, listener dans `app/listeners/`, binding dans `start/events.ts`
- **Doc** : [docs/emitter.md](./emitter.md)

## 2026-06-26 — Configuration des tests (Vitest + Japa)

Mise en place complète de l'environnement de tests backend (Japa) et frontend (Vitest).

- **Packages ajoutés** : `@japa/api-client`, `vitest`, `@vue/test-utils`, `happy-dom`
- **Fichiers ajoutés** :
  - `vitest.config.ts` — config Vitest séparée (plugin Vue, env `happy-dom`, aliases `~/` et `@generated`)
  - `tests/bootstrap.ts` — ajout du plugin `apiClient()` dans le tableau `plugins` Japa
  - `tests/unit/example.spec.ts` — exemple de test unitaire Japa
  - `tests/functional/example.spec.ts` — exemple de test fonctionnel HTTP Japa (client HTTP)
  - `tests/inertia/example.spec.ts` — exemple de test composant Vue avec `@vue/test-utils`
- **Comportement notable** :
  - Japa utilise SQLite en mode test (via `NODE_ENV=test` dans `config/database.ts`)
  - Les tests fonctionnels démarrent un serveur HTTP AdonisJS via `testUtils.httpServer().start()`
  - `SESSION_DRIVER=memory` dans `.env.test`
- **Commandes** :
  - Backend : `node ace test` (toutes suites) ou `node ace test --suites=unit|functional`
  - Frontend : `pnpm run test:inertia`
- **Doc** : [docs/tests.md](./tests.md)

## 2026-06-26 — Gestion des droits et permissions (Bouncer)

Installation et configuration de `@adonisjs/bouncer` pour l'autorisation.

- **Routes** : aucune route exposée — les vérifications se font dans les controllers via `ctx.bouncer`
- **Fichiers ajoutés** :
  - `app/abilities/main.ts` — abilities globales (`isAuthenticated`, `editOwnProfile`)
  - `app/policies/user_policy.ts` — policy `UserPolicy` (`view`, `update`, `delete`)
  - `app/middleware/initialize_bouncer_middleware.ts` — middleware branché sur `router` dans `start/kernel.ts`
- **Config** : `adonisrc.ts` mis à jour avec `bouncer_provider`, commandes et hook `indexPolicies()`
- **Usage controller** : `await bouncer.allows('isAuthenticated')` / `await bouncer.with(UserPolicy).authorize('update', user)`

## 2026-06-26 — Système de queue (background jobs)

Installation et configuration de `@adonisjs/queue` avec le driver PostgreSQL (via Lucid).

- **Routes** : aucune route HTTP exposée — les jobs sont dispatchés programmatiquement depuis les services/controllers
- **Tables créées** : `queue_jobs`, `queue_schedules` (migration `1782491779941_create_queue_tables`)
- **Fichiers ajoutés** : `config/queue.ts`, `start/scheduler.ts`, `app/jobs/` (dossier)
- **Config** : driver `database` sur la connexion `pg`, concurrence 5, délai idle 2s
- **Worker** : démarrer avec `node ace queue:work`
- **Comportement notable** : en environnement `test`, la connexion bascule sur SQLite ; en dev/prod, PostgreSQL est utilisé
- **Doc** : [docs/queue.md](./queue.md)
