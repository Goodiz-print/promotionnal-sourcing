# Back-office plateforme : rôles et journal d'audit

Socle du back-office `/:locale/admin` (epic #157) : rôles plateforme fins (#158) et journal d'audit des actions d'écriture (#159). Le rôle plateforme est indépendant du rôle dans une organisation : voir [`docs/organisations.md`](organisations.md) (§ Rôles : organisation vs plateforme).

## Rôles et droits

`users.platform_role` vaut `none` (défaut), `admin`, `moderator`, `support` ou `analyst`. Un rôle est un **ensemble de droits** (`PLATFORM_ROLE_PERMISSIONS`, `shared/types/user.ts`) ; les routes et le menu raisonnent en droits, jamais en rôles.

| Droit                  | admin | moderator | support | analyst | Ouvre                                                                     |
| ---------------------- | :---: | :-------: | :-----: | :-----: | ------------------------------------------------------------------------- |
| `backoffice.access`    |   x   |     x     |    x    |    x    | porte d'entrée `/admin/**`, tableau de bord                               |
| `organizations.view`   |   x   |     x     |    x    |         | liste et fiche des organisations                                          |
| `organizations.manage` |   x   |           |         |         | archiver, restaurer, modifier, changer type, gérer membres et invitations |
| `users.view`           |   x   |           |    x    |         | liste et fiche des utilisateurs                                           |
| `users.support`        |   x   |           |    x    |         | renvoyer vérification, reset mot de passe                                 |
| `users.manage`         |   x   |           |         |         | suspendre, réactiver, supprimer un compte                                 |
| `catalogue.manage`     |   x   |           |         |         | taxonomie (catégories, attributs)                                         |
| `roles.manage`         |   x   |           |         |         | attribuer un rôle plateforme                                              |
| `audit.view`           |   x   |           |         |         | journal d'audit                                                           |
| `monitoring.view`      |   x   |           |         |    x    | réservé aux écrans de monitoring à venir (lecture)                        |
| `trade.view`           |   x   |           |    x    |    x    | demandes de devis, devis, commandes (lecture)                             |
| `trade.manage`         |   x   |           |         |         | clôturer, expirer, relancer une demande de devis                          |

- **Backend** : ability `hasPlatformPermission(permission)` (`app/abilities/main.ts`) ; le middleware `platformAdmin` n'exige que `backoffice.access`, chaque contrôleur autorise le droit de sa section. `isPlatformAdmin` (rôle `admin` strict) est conservée ; `canManageCategories` repose sur `catalogue.manage`.
- **Frontend** : `platformRoleHasPermission` (`shared/helpers/platform_permissions.ts`) est partagé ; `useAdminTabs` et `usePlatformPermissions` n'affichent que les sections accessibles. Ce n'est qu'un confort d'affichage : le serveur re-vérifie chaque route.
- **Ajouter un droit** : le déclarer dans `PLATFORM_PERMISSIONS`, l'affecter aux rôles dans `PLATFORM_ROLE_PERMISSIONS`, puis `authorize('hasPlatformPermission', '<droit>')` dans le contrôleur (et une entrée dans `useAdminTabs` si la section a une page).
- **Attribution** : `PATCH /admin/users/:id/platform-role` (`admin.users.platform_role.update`, droit `roles.manage`), via le sélecteur de la colonne « Rôle plateforme ». Un admin ne peut pas modifier **son propre** rôle (flash d'erreur, aucun effet). Les commandes `admin:grant` / `admin:revoke` restent le moyen d'amorcer le premier admin.

## Journal d'audit

Table `admin_audit_logs`, **en ajout seul** (`AdminAuditService` n'expose que `record` et `list`) :

| Colonne                        | Rôle                                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| `actor_user_id`, `actor_email` | acteur ; l'email est un instantané, il survit à la suppression du compte (FK `SET NULL`) |
| `action`                       | `<domaine>.<verbe>`, valeurs dans `ADMIN_AUDIT_ACTIONS` (`shared/types/admin_audit.ts`)  |
| `target_type`, `target_id`     | cible polymorphe, sans clé étrangère (l'historique survit à la cible)                    |
| `changes`                      | `jsonb` : `before` / `after` (jamais de secret) ; `source: 'cli'` pour une commande ace  |
| `ip_address`, `created_at`     | origine de la requête et horodatage                                                      |

Actions tracées aujourd'hui : `platform_role.changed` (écran Utilisateurs et commandes ace, sans acteur dans ce second cas), `category.created` / `.updated` / `.deleted`, `attribute.created` / `.updated` / `.deleted` et `attribute_value.created` / `.updated` / `.deleted` (cibles `category`, `attribute`, `attribute_value`).

**Règle pour toute nouvelle action d'écriture admin** : le service qui écrit reçoit un `AdminActionContext` (le contrôleur le construit avec `adminActionContext(ctx)`), ouvre une transaction, et appelle `AdminAuditService.record(entry, { ...context, client: trx })` **dans cette transaction** — l'action et sa trace réussissent ou échouent ensemble. Effets de bord asynchrones (queue, mail) : après le commit. Une action sans changement effectif (même valeur) n'écrit rien. Ajouter la valeur à `ADMIN_AUDIT_ACTIONS`, ses libellés `admin.audit.actions.*` dans les 9 langues.

**Consultation** : `GET /admin/audit` (`admin.audit.index`, droit `audit.view`), 50 entrées par page, la plus récente d'abord. Filtres de query string : `action`, `targetType`, `actor` (email partiel, sans casse), `from` / `to` (`AAAA-MM-JJ`, bornes incluses). Une valeur de filtre invalide est refusée par la validation (`app/validators/admin_audit.ts`).

## Suivi des consultations

Table `activity_events`, en ajout seul (issue #172, epic #157), qui complète le journal des recherches `search_events` (#171, voir `docs/search.md`). L'exploitation (écran « Ce que cherchent les clients », KPI) relève de #173 et #174.

Types (`ActivityEventService`) : `product_viewed`, `supplier_viewed` (fiches publiques), `rfq_product_added` (ajout d'un produit à un brouillon), `rfq_sent` (envoi de la demande). Cible polymorphe `target_type` / `target_id`. Exclus : les visiteurs avec un rôle plateforme, un fournisseur qui consulte ses propres fiches, et les vues répétées du même utilisateur connecté sur 30 minutes (les visiteurs anonymes ne sont pas dédoublonnables).

**Écriture asynchrone** : `record` met `RecordActivityEventJob` en queue ; l'écran n'attend jamais l'écriture, et toute erreur est loggée sans être propagée.

**Rétention et RGPD** : `PurgeActivityEventsJob` (quotidien, 03:45 Paris) détache `user_id` et `organization_id` après 90 jours et supprime les lignes après 24 mois (constantes dans `shared/types/activity_event.ts`). La politique de confidentialité doit mentionner cette collecte.

**Funnel** : recherche → vue → ajout à la demande → envoi se reconstitue par utilisateur (`user_id`) et par date tant que le rattachement n'est pas pseudonymisé. Le clic depuis un résultat de recherche n'est pas encore tracé.

## Ce que cherchent les clients

Écran `GET /admin/demand` (`admin.demand.index`, droit `monitoring.view` : rôles `admin` et `analyst`), issue #173 (epic #157). Il lit `search_events` (#171) et `activity_events` (#172) ; toute l'agrégation est dans `AdminDemandService`, le contrôleur ne fait que valider les filtres.

**Filtres** (query string, tous optionnels) : `from` / `to` (`AAAA-MM-JJ`, bornes incluses ; 30 derniers jours par défaut), `source` (`catalogue`, `suppliers`, `rfq_lookup`), `locale` (langue de l'interface au moment de la recherche), `organizationType` (`buyer`, `supplier`, `both`, d'après l'organisation de l'utilisateur ; les visiteurs anonymes sont exclus dès qu'on filtre). Une valeur invalide est refusée par la validation (`app/validators/admin_demand.ts`).

**Contenu** : synthèse (recherches, sans résultat, taux sans résultat, part sémantique), évolution quotidienne, requêtes les plus fréquentes, requêtes sans résultat (opportunités de catalogue ou de synonymes), catégories parcourues, filtres les plus utilisés, modes de recherche, produits et fournisseurs les plus consultés, produits les plus ajoutés aux demandes de devis. Classements limités à 20 lignes. Le « graphique » d'évolution est un tableau avec barres décoratives (`aria-hidden`) : les chiffres restent accessibles.

**Export** : `GET /admin/demand/export` (`admin.demand.export`) renvoie en CSV (`;`, UTF-8 avec BOM) toutes les requêtes de la période, avec les mêmes filtres. Un terme commençant par `=`, `+`, `-` ou `@` est préfixé d'une apostrophe pour ne pas s'exécuter comme formule dans un tableur.

**Limites** : les libellés de catégories et de produits suivent la langue de l'écran, avec repli sur le français ; les noms de filtres sont les clés techniques. Les index existants (`created_at`, `(source, created_at)`, `(query, created_at)`) couvrent ces lectures ; les durées de rétention (24 mois) bornent le volume.

## Modération

Écran `GET /admin/moderation` (`admin.moderation.index`, droit `moderation.manage` : rôles `admin` et `moderator`), issue #163 (epic #157). Il s'appuie sur `ModerationService` (#54) ; la file et la décision sont dans `AdminModerationService`.

**Cibles** : les organisations fournisseurs actives (`supplier`, `both`, non archivées) et les produits actifs. Le statut courant est la dernière décision (`pending` sans décision). Filtres (query string, optionnels) : `type` (`organization`, `product`), `status` (`pending` par défaut, `approved`, `rejected`), `minAgeDays` (`0`, `7`, `30`, d'après la date de création). La file est triée du plus ancien au plus récent ; une valeur invalide est refusée par la validation.

**Décision** : `GET /admin/moderation/:type/:id` (historique et formulaire), `POST /admin/moderation/:type/:id/decision` (`status` `approved` ou `rejected`, `reason` obligatoire pour un rejet). La décision et son entrée d'audit (`moderation.approved` / `moderation.rejected`, avant/après, motif) sont écrites dans une même transaction ; la réindexation (`ProductChanged`, `OrganizationCatalogueChanged`) n'est émise qu'après validation de la transaction. Une cible inconnue ou non modérable répond 404.

**Visibilité** : le compteur « à modérer » (organisations + produits en attente) s'affiche sur le tableau de bord pour les rôles qui ont le droit. Le fournisseur voit le statut de son organisation et le dernier motif de rejet sur son profil (`/supplier/profile`).

**Limite** : sans décision, une cible reste visible du public (la modération retire, elle ne valide pas, cf. `docs/entites-transverses.md`). La file « en attente » reprend donc tout le catalogue existant tant qu'il n'a pas été examiné.

## Tests

- `tests/unit/platform_permissions.spec.ts` : matrice rôle → droits.
- `tests/functional/admin_roles.spec.ts` : statut HTTP de chaque section par rôle, attribution (audit, refus, rôle propre, rôle inconnu), commande `admin:grant`.
- `tests/functional/admin_audit.spec.ts` : consultation, filtres, accès, audit des catégories.
- `tests/inertia/admin_users.spec.ts`, `tests/inertia/admin_audit.spec.ts` : écrans.
- Factories : `UserFactory.apply('platformAdmin' | 'platformModerator' | 'platformSupport' | 'platformAnalyst')`, `AdminAuditLogFactory`.
- `tests/functional/activity_events.spec.ts` : consultations et rétention. Factory : `ActivityEventFactory`.
- `tests/functional/admin_moderation.spec.ts`, `tests/inertia/admin_moderation.spec.ts` : file, filtres, décisions, audit, réindexation, écrans.
- `tests/functional/admin_demand.spec.ts` : droits par rôle, agrégations, filtres, export CSV.

## Tableau de bord KPI (#174)

`GET /admin` (`admin.dashboard`) : compteurs pour tous les rôles du back-office ; indicateurs de période (comptes, demandes de devis, devis, commandes, catalogue, agences à revoir, activité quotidienne) pour `monitoring.view`. Filtres `from` / `to` (30 jours par défaut, 366 jours maximum). Chaque indicateur est comparé à la période précédente de même durée ; un ratio ou une durée sans événement vaut `null` (affiché « — »). Agrégations dans `AdminKpiService`, jours groupés dans le fuseau de l'application. Détail : `docs/changelog/2026-11-03-tableau-de-bord-kpi.md`.

## Revue des inscriptions agence (#162)

`GET /admin/agency-reviews` (`admin.agency_reviews.index`), fiche `GET /admin/agency-reviews/:id`, décision `POST /admin/agency-reviews/:id/decision` ; droit `moderation.manage` (rôles `admin` et `moderator`). Source : `organizations.review_reasons`, `vat_verified_at`, `domain_verified_at` renseignés par `AgencySignupService` ; toute la logique est dans `AdminAgencyReviewService`.

**Statut** : dernier enregistrement de `agency_review_decisions` (ajout seul) ou `pending`. Filtre `status` : `open` (défaut : motifs non vides et agence non archivée), `approved`, `rejected`. Une agence validée automatiquement à l'inscription (aucun motif) n'apparaît jamais dans la file.

**Décisions** : `approved` (vide les motifs), `rejected` (archive l'organisation ; motif obligatoire), `info_requested` (l'agence reste à revoir ; motif obligatoire, envoyé comme message). Une décision sur une agence déjà traitée ou archivée renvoie 409. L'organisation est verrouillée le temps de la décision (deux décisions simultanées : la seconde reçoit 409) et le rejet archive dans la même transaction (`OrganizationService.archiveWithin`). Chaque décision écrit une entrée d'audit (`agency_review.*`) dans la même transaction et met en queue un mail par propriétaire (`AgencyReviewDecisionNotification`, langue de l'utilisateur).

Le compteur `pendingAgencyReviews` du tableau de bord reprend les agences « à revoir ». Détail : `docs/changelog/2026-11-03-revue-des-inscriptions-agence.md`.

## Supervision des demandes de devis, devis et commandes (#166)

Trois écrans transverses (toutes organisations, archivées comprises), droit `trade.view` (admin, support, analyste) : `GET /admin/rfqs` (`admin.rfqs.index`) et fiche `/admin/rfqs/:id`, `GET /admin/quotes` et `/admin/quotes/:id`, `GET /admin/orders` et `/admin/orders/:id`. Lecture dans `AdminTradeService` (requêtes explicites, pagination de 25).

**Filtres** (query string, tous optionnels, valeur invalide refusée en 422) : `status`, `buyer` et `supplier` (nom partiel, sans casse, jokers `%` `_` échappés ; pour une demande, « fournisseur » = l'un de ses destinataires), `from` / `to` (`AAAA-MM-JJ`, bornes incluses, sur la date de création) ; pour les demandes, `attention`.

**Repérage** (`attention`, calculé en SQL) : `overdue` = demande publiée dont l'échéance (jour calendaire de Paris) est passée sans que le job d'expiration l'ait basculée ; `no_response` = publiée depuis `RFQ_REMINDER_AFTER_DAYS` jours sans aucun devis remis.

**Interventions** (droit `trade.manage`, rôle `admin`), réutilisant les transitions de `RfqService` : `POST /admin/rfqs/:id/close` (`published` → `closed`, 422 sinon), `/expire` (`published` → `expired`, les devis ouverts expirent avec elle), `/remind` (relance **une fois** chaque destinataire `sent` ou `viewed` jamais relancé, comme `RemindRfqSuppliersJob` ; 409 si la demande n'attend plus de réponse ou si personne n'est relançable). Chacune écrit son entrée d'audit (`rfq.closed`, `rfq.expired`, `rfq.reminded`, cible `rfq`) dans la même transaction (`AdminRfqInterventionService`) ; les mails et l'expiration des devis partent ensuite. Détail : `docs/changelog/2026-11-03-supervision-rfq-devis-commandes.md`.

Tests : `tests/functional/admin_trade.spec.ts` (droits par rôle, filtres, repérage, interventions, audit, mails) et `tests/inertia/admin_*` des écrans.

## Gestion des organisations (#161)

`GET /admin/organizations` (`admin.organizations.index`, droit `organizations.view`) et fiche `GET /admin/organizations/:id` (`admin.organizations.show`). Lecture dans `AdminOrganizationService` ; toutes les organisations y compris archivées sont accessibles.

**Filtres** (query string, tous optionnels, valeur invalide refusée en 422) : `search` (nom, slug, SIRET ou TVA — partiel, insensible à la casse, jokers `%` `_` échappés), `type` (`buyer`, `supplier`, `both`), `status` (`active` par défaut, `archived`, `all`), `country` (code ISO 2 lettres). La liste expose `filterOptions` (types et pays distincts) pour le frontend.

**Fiche** : informations complètes (nom, slug, type, pays, email, téléphone, site, SIRET, TVA, secteur, taille, description, adresse, logo, dates), membres (avec `membershipId` pour les actions), invitations en attente, profils (fournisseur, agence avec `reviewReasons`/`vat_verified_at`/`domain_verified_at`, facturation — `stripeCustomerId` omis), volumes de produits et de demandes de devis, dernière activité des membres, flag `canManage`.

**Actions** (droit `organizations.manage`, rôle `admin`), toutes via redirection + flash, auditées dans la même transaction :

| Route                                                              | Action                               | Audit                                |
| ------------------------------------------------------------------ | ------------------------------------ | ------------------------------------ |
| `POST   /admin/organizations/:id/archive`                          | archive l'organisation               | `organization.archived`              |
| `POST   /admin/organizations/:id/restore`                          | restaure l'organisation              | `organization.restored`              |
| `PATCH  /admin/organizations/:id`                                  | modifie les informations             | `organization.updated` (avant/après) |
| `PATCH  /admin/organizations/:id/type`                             | change le type (buyer/supplier/both) | `organization.type_changed`          |
| `PATCH  /admin/organizations/:id/members/:membershipId/role`       | change le rôle d'un membre           | `organization.member_role_changed`   |
| `DELETE /admin/organizations/:id/members/:membershipId`            | retire un membre                     | `organization.member_removed`        |
| `DELETE /admin/organizations/:id/invitations/:invitationId`        | révoque une invitation               | `organization.invitation_revoked`    |
| `POST   /admin/organizations/:id/invitations/:invitationId/resend` | renvoie une invitation               | `organization.invitation_resent`     |

**Invariants et idempotence** :

- Archiver une organisation déjà archivée ou restaurer une active → 409, sans audit.
- Archiver révoque automatiquement les invitations en attente (même transaction) et émet `OrganizationCatalogueChanged` après commit.
- Restaurer émet aussi `OrganizationCatalogueChanged` pour réindexer le catalogue.
- Modifier sans changement effectif → pas d'audit.
- Changement de type : **refusé** (409) si on passe à un type sans capacité fournisseur (`buyer`) alors que l'organisation a des produits ou un profil fournisseur actif. Le cas échéant, émet `OrganizationCatalogueChanged`.
- Retirer un membre ou rétrograder un owner : **refusé** (409) si c'est le dernier `owner` de l'organisation — une organisation garde toujours au moins un propriétaire. Si le membre retiré avait cette organisation comme courante, il bascule sur une autre (ou sur l'onboarding).
- Une organisation archivée reste modifiable par l'admin (informations, membres, invitations).
- Le verrou `FOR UPDATE` sur l'organisation dans la transaction de chaque action garantit la cohérence.

**Réutilisation** : les services `OrganizationService.archiveWithin`/`notifyArchived`, `OrganizationMembersService`, `OrganizationInvitationsService`, `OrganizationContextService.reassignCurrentOrganization` sont réutilisés avec leur paramètre `client` de transaction.

Tests : `tests/functional/admin_organizations.spec.ts` (recherche, filtres, fiche enrichie, droits par rôle, chaque action + audit). Détail : `docs/changelog/2026-11-04-gestion-organisations-admin.md`.
