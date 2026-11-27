# Back-office plateforme : rôles et journal d'audit

Socle du back-office `/:locale/admin` (epic #157) : rôles plateforme fins (#158) et journal d'audit des actions d'écriture (#159). Le rôle plateforme est indépendant du rôle dans une organisation : voir [`docs/organisations.md`](organisations.md) (§ Rôles : organisation vs plateforme).

## Rôles et droits

`users.platform_role` vaut `none` (défaut), `admin`, `moderator`, `support` ou `analyst`. Un rôle est un **ensemble de droits** (`PLATFORM_ROLE_PERMISSIONS`, `shared/types/user.ts`) ; les routes et le menu raisonnent en droits, jamais en rôles.

| Droit                  | admin | moderator | support | analyst | Ouvre                                                                     |
| ---------------------- | :---: | :-------: | :-----: | :-----: | ------------------------------------------------------------------------- |
| `backoffice.access`    |   x   |     x     |    x    |    x    | porte d'entrée `/admin/**`, tableau de bord                               |
| `organizations.view`   |   x   |     x     |    x    |         | liste et fiche des organisations                                          |
| `organizations.manage` |   x   |           |         |         | archiver, restaurer, modifier, changer type, gérer membres et invitations |
| `products.view`        |   x   |     x     |    x    |         | liste et fiche des produits                                               |
| `products.manage`      |   x   |           |         |         | masquer, publier, archiver, réindexer un produit                          |
| `users.view`           |   x   |           |    x    |         | liste et fiche des utilisateurs                                           |
| `users.support`        |   x   |           |    x    |         | renvoyer vérification, reset mot de passe                                 |
| `users.manage`         |   x   |           |         |         | suspendre, réactiver, supprimer un compte                                 |
| `catalogue.manage`     |   x   |           |         |         | taxonomie (categories, attributs, certifications, techniques de marquage) |
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

Actions tracees aujourd'hui : `platform_role.changed` (ecran Utilisateurs et commandes ace, sans acteur dans ce second cas), `category.created` / `.updated` / `.deleted` / `.reordered`, `attribute.created` / `.updated` / `.deleted`, `attribute_value.created` / `.updated` / `.deleted`, `certification.created` / `.updated` / `.deleted`, `marking_technique.created` / `.updated` / `.deleted`, `category_attribute.added` / `.updated` / `.removed` (cibles `category`, `attribute`, `attribute_value`, `certification`, `marking_technique`, `category_attribute`), `conversation.viewed` / `.blocked` / `.unblocked`, `message.hidden` / `.unhidden` / `.warned`, `message_report.dismissed` (cibles `conversation`, `message`, `message_report`).

**Règle pour toute nouvelle action d'écriture admin** : le service qui écrit reçoit un `AdminActionContext` (le contrôleur le construit avec `adminActionContext(ctx)`), ouvre une transaction, et appelle `AdminAuditService.record(entry, { ...context, client: trx })` **dans cette transaction** — l'action et sa trace réussissent ou échouent ensemble. Effets de bord asynchrones (queue, mail) : après le commit. Une action sans changement effectif (même valeur) n'écrit rien. Ajouter la valeur à `ADMIN_AUDIT_ACTIONS`, ses libellés `admin.audit.actions.*` dans les 9 langues.

**Consultation** : `GET /admin/audit` (`admin.audit.index`, droit `audit.view`), 50 entrées par page, la plus récente d'abord. Filtres de query string : `action`, `targetType`, `actor` (email partiel, sans casse), `from` / `to` (`AAAA-MM-JJ`, bornes incluses). Une valeur de filtre invalide est refusée par la validation (`app/validators/admin_audit.ts`).

## Suivi des consultations

Table `activity_events`, en ajout seul (issue #172, epic #157), qui complète le journal des recherches `search_events` (#171, voir `docs/search.md`). L'exploitation (écran « Ce que cherchent les clients », KPI) relève de #173 et #174 ; côté fournisseur, la page « Consultations » (#239, cf. `docs/comptes-fournisseurs-agences.md`).

Types (`ActivityEventService`) : `product_viewed`, `supplier_viewed` (fiches publiques), `rfq_product_added` (ajout d'un produit à un brouillon), `rfq_sent` (envoi de la demande). Cible polymorphe `target_type` / `target_id`, indexée avec `created_at` (#239). Exclus : les visiteurs avec un rôle plateforme, un fournisseur qui consulte ses propres fiches, et les vues répétées du même utilisateur connecté sur 30 minutes (les visiteurs anonymes ne sont pas dédoublonnables).

**Écriture asynchrone** : `record` met `RecordActivityEventJob` en queue ; l'écran n'attend jamais l'écriture, et toute erreur est loggée sans être propagée.

**Rétention et RGPD** : `PurgeActivityEventsJob` (quotidien, 03:45 Paris) détache `user_id` et `organization_id` après 90 jours et supprime les lignes après 24 mois (constantes dans `shared/types/activity_event.ts`). La politique de confidentialité doit mentionner cette collecte.

**Funnel** : recherche → vue → ajout à la demande → envoi se reconstitue par utilisateur (`user_id`) et par date tant que le rattachement n'est pas pseudonymisé. Le clic depuis un résultat de recherche n'est pas encore tracé.

## Ce que cherchent les clients

Écran `GET /admin/demand` (`admin.demand.index`, droit `monitoring.view` : rôles `admin` et `analyst`), issue #173 (epic #157). Il lit `search_events` (#171) et `activity_events` (#172) ; toute l'agrégation est dans `AdminDemandService`, le contrôleur ne fait que valider les filtres. Les briques de lecture de `activity_events` (période, comptage par cible, nom des cibles, avec repli sur la langue source du produit) sont dans `ActivityAggregationService`, partagé avec l'espace fournisseur (#239) ; les calculs purs dans `shared/helpers/activity_event.ts`.

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

## Administration du catalogue produits (#164)

`GET /admin/products` (`admin.products.index`, droit `products.view`) et fiche `GET /admin/products/:id` (`admin.products.show`). Lecture dans `AdminProductService` ; tous les produits y compris inactifs, masqués ou archivés sont accessibles.

**Filtres** (query string, tous optionnels, valeur invalide refusée en 422) : `search` (nom traduit, slug, SKU de variante ou nom d'organisation fournisseur — partiel, insensible à la casse), `supplierId` (ID de l'organisation fournisseur), `categoryId` (inclut les sous-catégories), `visibility` (`published`, `unpublished`, `hidden`, `archived`), `quality` (`no_image`, `no_translation`, `no_variant`). Pagination de 25 éléments.

**Fiche** : informations complètes du produit, fournisseur (avec lien vers l'organisation), catégorie, statut de visibilité calculé (`published` = actif + non masqué + non archivé, `unpublished` = is_active=false, `hidden` = dernière décision de modération rejetée, `archived` = lifecycle_status=retired), variantes (SKU, stock, actif), paliers de prix, images (avec variantes redimensionnées), traductions (locale + présence), certifications, attributs, historique de modération. Flag `canManage` selon le droit de l'utilisateur courant.

**Actions** (droit `products.manage`, rôle `admin`), toutes via redirection + flash, auditées dans la même transaction :

| Route                                | Action                                                        | Audit                       |
| ------------------------------------ | ------------------------------------------------------------- | --------------------------- |
| `POST /admin/products/:id/hide`      | masque via modération `rejected` (motif obligatoire)          | `product.hidden`            |
| `POST /admin/products/:id/unhide`    | révèle via modération `approved`                              | `product.unhidden`          |
| `POST /admin/products/:id/unpublish` | dépublie (is_active=false)                                    | `product.unpublished`       |
| `POST /admin/products/:id/publish`   | publie (is_active=true)                                       | `product.published`         |
| `POST /admin/products/:id/archive`   | archive (lifecycle_status=retired ET is_active=false)         | `product.archived`          |
| `POST /admin/products/:id/restore`   | restaure (lifecycle_status=active, is_active inchangé)        | `product.restored`          |
| `POST /admin/products/:id/reindex`   | demande une réindexation via `SearchSyncService.queueProduct` | `product.reindex_requested` |

**Invariants et idempotence** :

- Masquer un produit déjà masqué ou révéler un produit non masqué → 409, sans audit.
- Dépublier un produit déjà dépublié ou publier un produit déjà publié → 409, sans audit.
- Archiver un produit déjà archivé ou restaurer un produit non archivé → 409, sans audit.
- Masquer/révéler réutilise `ModerationService.decide(input, trx)` qui gère la réindexation after-commit.
- Les autres actions de visibilité (unpublish, publish, archive, restore) émettent `ProductChanged` after-commit pour la réindexation.
- Le verrou `FOR UPDATE` sur le produit dans la transaction de chaque action garantit la cohérence.

**Réutilisation** : `ModerationService.decide` pour hide/unhide, `SearchSyncService.queueProduct` pour reindex.

Tests : `tests/functional/admin_products.spec.ts` (droits par rôle, filtres, chaque action + audit + no-op, réindexation).

## Modération de la messagerie (#167)

Droit `moderation.manage` (admin, modérateur). Écrans : `GET /admin/messaging` (fils, sans contenu), `/admin/messaging/reports` (file des signalements), `/admin/messaging/conversations/:id` (fil complet — **chaque ouverture est tracée** par `conversation.viewed`). Décisions : masquer / réafficher un message, avertir son auteur (notification `message.warned`), classer un signalement, bloquer / débloquer un fil (motif obligatoire). Côté participant : `POST /messages/:id/report` (`messages.report`). Détail : `docs/changelog/2026-11-04-moderation-messagerie-admin.md`.

## Consentements légaux (#168)

Droit `audit.view` (admin seul : IP et email). `GET /admin/consents` (liste filtrable, repère les versions dépassées) et `GET /admin/consents/export?organizationId=` (CSV de preuve, tracé par `consent.exported`). Les parcours fournisseur n'écrivent pas encore de consentement. Détail : `docs/changelog/2026-11-05-consentements-legaux-admin.md`.

## Annonces plateforme (#169)

Droit `announcements.manage` (admin seul). `GET /admin/announcements` (historique avec taux de lecture in-app), `GET /admin/announcements/new` et `POST /admin/announcements` : envoi à un segment (tous, acheteurs, fournisseurs, agences, une organisation) en notification in-app et/ou par mail, contenu fr (obligatoire) et en, distribué par la queue (`SendAnnouncementJob`) et tracé par `announcement.created`. `POST /admin/announcements/:id/retry` relance une annonce échouée ou perdue en queue (`announcement.retried`). Détail : `docs/changelog/2026-11-05-annonces-plateforme-admin.md`.

## Suivi des imports (#170)

Droit `imports.manage` (admin seul : les erreurs reprennent des valeurs saisies par les fournisseurs). `GET /admin/imports` (liste filtrable par statut, type et organisation), `GET /admin/imports/:id` (progression, erreurs conservées, chaîne de relances), `POST /admin/imports/:id/retry` (nouvel import mis en queue par `RunImportJob`, tracé par `import.retried`) et `GET /admin/imports/:id/errors` (CSV des erreurs, tracé par `import.errors_exported`). Le moteur de traitement relève de #77 : tant qu'il n'existe pas, un import relancé est clos en échec avec un motif explicite. Détail : `docs/changelog/2026-11-05-suivi-imports-admin.md`.

## IA et traductions (#177)

Droit `ai.manage` (admin seul). `GET /admin/ai` (appels, échecs, tokens, coût estimé, couverture par langue, volume, derniers échecs), `POST /admin/ai/backfill` (rattrapage des traductions, traité par `TranslationBackfillJob`, un lancement toutes les 10 minutes, tracé par `ai.backfill_requested`), `GET /admin/ai/translations` et `PATCH /admin/ai/translations/:entity/:id/:translationLocale` (relecture : une traduction corrigée ou validée devient manuelle et n'est plus écrasée, tracée par `translation.corrected`). Les appels sont journalisés dans `ai_calls` par `TranslationService`. Le coût demande `AI_PRICE_INPUT_PER_MILLION` / `AI_PRICE_OUTPUT_PER_MILLION`. Détail : `docs/changelog/2026-11-05-suivi-ia-traductions-admin.md`.

## Supervision de la queue (#175)

Droit `queue.manage` (admin seul : les charges utiles peuvent contenir des données personnelles). `GET /admin/queue` (santé via `HealthService`, effectifs par état, jobs planifiés, liste filtrable par état — dont `stuck` — et par nom), `GET /admin/queue/jobs/:queue/:id` (erreur et charge utile tronquées), `POST …/retry` (job échoué remis en file, `queue_job.retried`), `POST …/cancel` (job en attente, différé ou échoué ; jamais un job actif, `queue_job.cancelled`) et `POST /admin/queue/schedules/:id/run` (lancement manuel d'un des sept jobs de maintenance, `queue_schedule.run`). Le tableau de bord affiche le rapport de santé. Détail : `docs/changelog/2026-11-05-supervision-queue-admin.md`.

## État de la recherche (#176)

Droit `search.manage` (admin seul : une réindexation charge le moteur et l'évaluation sollicite l'API d'embeddings). `GET /admin/search` (statut du moteur, écart PostgreSQL ↔ index à la demande, historique des réindexations et des évaluations), `POST /admin/search/reindex` (complète, ou limitée à `supplierId`, tracée par `search.reindex_requested`) et `POST /admin/search/evaluate` (`search.evaluation_requested`). Les deux opérations sont traitées par `SearchRunJob` et suivies dans `search_runs` ; l'écran se rafraîchit seul tant qu'une opération est en cours. Sans `MEILISEARCH_HOST`, le tableau de bord affiche une alerte pour le droit `search.manage`. Détail : `docs/changelog/2026-11-06-etat-recherche-admin.md` et `docs/search.md` (§ Supervision depuis le back-office).

## Emails en échec et stockage Cellar (#178)

Droit `ops.manage` (admin seul : adresses des destinataires, erreurs SMTP). `GET /admin/mail` (taux d'échec par type sur 30 jours, liste filtrable par état et par type), `GET /admin/mail/:id` (erreur complète, jamais la charge : elle contient des URL signées), `POST /admin/mail/:id/retry` (`mail.retried`) et `POST /admin/mail/retry` (rejeu groupé, optionnellement limité à un `kind`, 200 mails au plus, `mail.bulk_retried`). Les rejeux remettent le **même** `SendMailPayload` en queue (`SendMailJob`, même clé d'idempotence) : un mail déjà parti n'est jamais renvoyé. `GET /admin/storage` (objets par état, arriéré `pending_*` de plus de 24 h, volume prêt par organisation) et `POST /admin/storage/recover` (`RecoverStorageUploadsJob`, `storage.recovery_requested`). Détail : `docs/changelog/2026-11-06-emails-stockage-admin.md`.

## Santé de la plateforme et alertes (#179)

Droit `ops.manage` (admin seul). `GET /admin/health` (sonde en direct la base, la queue, Meilisearch, Cellar, les mails, VIES, Mistral et Claude, avec le statut, la durée et l'état conservé par composant). `GET /health/details` (`Authorization: Bearer <HEALTH_TOKEN>`, 404 sans jeton configuré, 503 si le statut global est `down`) pour la supervision externe. `GET /health` reste la sonde de liveness : la base seule, aucun autre composant. Le job `check-platform-health` (toutes les 5 minutes) conserve l'état de chaque composant et alerte par log et par mail à `MAIL_ALERT_ADDRESS` après `HEALTH_ALERT_AFTER_FAILURES` passes consécutives (une alerte par incident, puis une au rétablissement). Le tableau de bord affiche les derniers états, avec un avertissement quand la dernière passe a plus de 15 minutes (worker arrêté). Une alerte dont le mail n'a pas pu partir est rejouée à la passe suivante. `/health/details` est limité à 60 appels par minute et par IP. La sonde Cellar fait un `HEAD` : la clé d'accès doit pouvoir lire le bucket (une clé Cellar standard le peut). Détail et seuils : `docs/changelog/2026-11-08-sante-plateforme-admin.md`.
