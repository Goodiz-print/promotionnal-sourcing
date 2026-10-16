# Invitations de membres par email (PR 3/3 gestion des organisations)

> Date : 2026-07-17

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
