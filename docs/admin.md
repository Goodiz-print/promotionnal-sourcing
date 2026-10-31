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

## Collecte de la demande client

Deux tables en ajout seul alimentent le monitoring de ce que cherchent et regardent les clients (issues #171 et #172, epic #157). L'exploitation (écran « Ce que cherchent les clients », KPI) est faite par les issues #173 et #174.

**`search_events`** (`SearchEventService`) : une ligne par recherche sur `catalogue` (`/products`), `suppliers` (`/suppliers`) ou `rfq_lookup` (sélecteur de produit d'une demande de devis). Colonnes : `term` (normalisé : minuscules, espaces écrasés, 255 caractères), `filters` (jsonb, filtres actifs seulement), `category_id`, `mode` (`semantic`, `keywords`, `unavailable`, `directory`), `results_count` (« zéro résultat » = 0), `user_id`, `organization_id`, `locale`, `created_at`. Règles : première page seulement (la pagination ne relance pas la recherche) ; une page sans terme, catégorie ni filtre n'est pas enregistrée ; une recherche moteur indisponible est enregistrée en mode `unavailable`.

**`activity_events`** (`ActivityEventService`) : `product_viewed`, `supplier_viewed` (fiches publiques), `rfq_product_added` (ajout d'un produit à un brouillon), `rfq_sent` (envoi de la demande). Cible polymorphe `target_type` / `target_id`. Exclus : les visiteurs avec un rôle plateforme, un fournisseur qui consulte ses propres fiches, et les vues répétées du même utilisateur connecté sur 30 minutes (les visiteurs anonymes ne sont pas dédoublonnables).

**Écriture asynchrone** : `record` met un job en queue (`RecordSearchEventJob`, `RecordActivityEventJob`) ; la requête n'attend jamais l'écriture, et toute erreur est loggée sans être propagée.

**Rétention et RGPD** : `PurgeDemandEventsJob` (quotidien, 03:45 Paris) détache `user_id` et `organization_id` après 90 jours et supprime les lignes après 365 jours (constantes dans `shared/types/search_event.ts`). La politique de confidentialité doit mentionner cette collecte.

**Funnel** : recherche → vue → ajout à la demande → envoi se reconstitue par utilisateur (`user_id`) et par date tant que le rattachement n'est pas pseudonymisé. Le clic depuis un résultat de recherche n'est pas encore tracé (pas de lien explicite entre un `search_events` et la vue qui suit).

**Ajouter une nouvelle recherche ou un nouvel événement** : injecter le service, l'appeler dans le contrôleur (jamais de `new`), ajouter le type dans `shared/types/`.

## Tests

- `tests/unit/platform_permissions.spec.ts` : matrice rôle → droits.
- `tests/functional/admin_roles.spec.ts` : statut HTTP de chaque section par rôle, attribution (audit, refus, rôle propre, rôle inconnu), commande `admin:grant`.
- `tests/functional/admin_audit.spec.ts` : consultation, filtres, accès, audit des catégories.
- `tests/inertia/admin_users.spec.ts`, `tests/inertia/admin_audit.spec.ts` : écrans.
- Factories : `UserFactory.apply('platformAdmin' | 'platformModerator' | 'platformSupport' | 'platformAnalyst')`, `AdminAuditLogFactory`.
- `tests/unit/search_event.spec.ts`, `tests/functional/search_events.spec.ts`, `tests/functional/activity_events.spec.ts` : collecte et rétention. Factories : `SearchEventFactory`, `ActivityEventFactory`.
