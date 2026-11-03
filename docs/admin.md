# Back-office plateforme : rôles et journal d'audit

Socle du back-office `/:locale/admin` (epic #157) : rôles plateforme fins (#158) et journal d'audit des actions d'écriture (#159). Le rôle plateforme est indépendant du rôle dans une organisation : voir [`docs/organisations.md`](organisations.md) (§ Rôles : organisation vs plateforme).

## Rôles et droits

`users.platform_role` vaut `none` (défaut), `admin`, `moderator`, `support` ou `analyst`. Un rôle est un **ensemble de droits** (`PLATFORM_ROLE_PERMISSIONS`, `shared/types/user.ts`) ; les routes et le menu raisonnent en droits, jamais en rôles.

| Droit                | admin | moderator | support | analyst | Ouvre                                              |
| -------------------- | :---: | :-------: | :-----: | :-----: | -------------------------------------------------- |
| `backoffice.access`  |   x   |     x     |    x    |    x    | porte d'entrée `/admin/**`, tableau de bord        |
| `organizations.view` |   x   |     x     |    x    |         | liste et fiche des organisations                   |
| `users.view`         |   x   |           |    x    |         | liste des utilisateurs                             |
| `catalogue.manage`   |   x   |           |         |         | taxonomie (catégories, attributs)                  |
| `roles.manage`       |   x   |           |         |         | attribuer un rôle plateforme                       |
| `audit.view`         |   x   |           |         |         | journal d'audit                                    |
| `monitoring.view`    |   x   |           |         |    x    | réservé aux écrans de monitoring à venir (lecture) |

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

Table `activity_events`, en ajout seul (issue #172, epic #157), qui complète le journal des recherches `search_events` (#171, voir `docs/search.md`). L'exploitation par l'écran « Ce que cherchent les clients » est décrite plus bas (#173) ; les KPI relèvent de #174.

Types (`ActivityEventService`) : `product_viewed`, `supplier_viewed` (fiches publiques), `rfq_product_added` (ajout d'un produit à un brouillon), `rfq_sent` (envoi de la demande). Cible polymorphe `target_type` / `target_id`. Exclus : les visiteurs avec un rôle plateforme, un fournisseur qui consulte ses propres fiches, et les vues répétées du même utilisateur connecté sur 30 minutes (les visiteurs anonymes ne sont pas dédoublonnables).

**Écriture asynchrone** : `record` met `RecordActivityEventJob` en queue ; l'écran n'attend jamais l'écriture, et toute erreur est loggée sans être propagée.

**Rétention et RGPD** : `PurgeActivityEventsJob` (quotidien, 03:45 Paris) détache `user_id` et `organization_id` après 90 jours et supprime les lignes après 24 mois (constantes dans `shared/types/activity_event.ts`). La politique de confidentialité doit mentionner cette collecte.

**Funnel** : recherche → vue → ajout à la demande → envoi se reconstitue par utilisateur (`user_id`) et par date tant que le rattachement n'est pas pseudonymisé. Le clic depuis un résultat de recherche n'est pas encore tracé.

## Ce que cherchent les clients

Écran `GET /admin/search` (`admin.search.index`, droit `monitoring.view` : `admin` et `analyst`) et export `GET /admin/search/export` (`admin.search.export`), issue #173. Il agrège `search_events` et `activity_events` dans `SearchInsightsService` (aucune logique dans le contrôleur).

- **Filtres** (query string) : `from` / `to` (`AAAA-MM-JJ`, bornes incluses, 30 derniers jours par défaut, 366 jours au plus), `source` (catalogue, fournisseurs, lookup RFQ), `locale`, `organizationType` (acheteur, fournisseur, les deux). Une valeur invalide est refusée par la validation.
- **Contenu** : synthèse (total, sans résultat, taux, modes sémantique / mots-clés / indisponible / navigation, comparaison à la période précédente de même durée), courbe quotidienne, top requêtes, requêtes **sans résultat** (opportunités de catalogue ou de synonymes), catégories et filtres les plus utilisés, produits et fournisseurs les plus consultés avec ajouts à une RFQ.
- **Export CSV** : mêmes filtres, UTF-8 avec BOM, cellules commençant par `=`, `+`, `-` ou `@` neutralisées contre l'injection de formules.
- **Limites** : les recherches dont l'auteur est pseudonymisé (au-delà de 90 jours) restent comptées mais sortent du filtre `organizationType`.

## Tests

- `tests/unit/platform_permissions.spec.ts` : matrice rôle → droits.
- `tests/functional/admin_roles.spec.ts` : statut HTTP de chaque section par rôle, attribution (audit, refus, rôle propre, rôle inconnu), commande `admin:grant`.
- `tests/functional/admin_audit.spec.ts` : consultation, filtres, accès, audit des catégories.
- `tests/inertia/admin_users.spec.ts`, `tests/inertia/admin_audit.spec.ts` : écrans.
- Factories : `UserFactory.apply('platformAdmin' | 'platformModerator' | 'platformSupport' | 'platformAnalyst')`, `AdminAuditLogFactory`.
- `tests/functional/activity_events.spec.ts` : consultations et rétention. Factory : `ActivityEventFactory`.
- `tests/functional/admin_search_insights.spec.ts`, `tests/inertia/admin_search_*.spec.ts` : écran « Ce que cherchent les clients ».
