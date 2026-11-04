# Gestion des utilisateurs : fiche, suspension, support, RGPD

Date : 2026-11-04

Issue : #160

## Résumé

Back-office plateforme : gestion complète des comptes utilisateurs, réservée aux rôles `admin` et `support`.

## Nouvelles permissions

| Permission      | admin | support | Description                                     |
| --------------- | :---: | :-----: | ----------------------------------------------- |
| `users.support` |   x   |    x    | Renvoyer vérification email, reset mot de passe |
| `users.manage`  |   x   |         | Suspendre, réactiver, supprimer un compte       |

`users.view` reste requis pour accéder à la liste et aux fiches.

## Routes

### Lecture

- `GET /admin/users` (`admin.users.index`) : liste paginée avec filtres étendus
- `GET /admin/users/:id` (`admin.users.show`) : fiche détaillée

### Actions (toutes via POST/DELETE + redirect, jamais JSON)

- `POST /admin/users/:id/suspend` (`admin.users.suspend`) : suspend le compte
- `POST /admin/users/:id/reactivate` (`admin.users.reactivate`) : réactive le compte
- `POST /admin/users/:id/resend-verification` (`admin.users.resend_verification`) : renvoie l'email de vérification
- `POST /admin/users/:id/password-reset` (`admin.users.password_reset`) : déclenche un reset de mot de passe
- `DELETE /admin/users/:id` (`admin.users.destroy`) : supprime le compte (anonymisation RGPD)

## Filtres de la liste

| Filtre             | Valeurs                                                |
| ------------------ | ------------------------------------------------------ |
| `search`           | Email partiel (ILIKE)                                  |
| `platformRole`     | `admin`, `moderator`, `support`, `analyst`, `any-role` |
| `emailVerified`    | `verified`, `unverified`                               |
| `activity`         | `recent` (30 jours), `never`                           |
| `organizationType` | `buyer`, `supplier`, `both`                            |
| `status`           | `active`, `suspended`                                  |

Valeur invalide → 422 (comme les autres écrans admin).

## Fiche utilisateur

Affiche :

- Identité (email, nom, civilité, locale, dates)
- Rôle plateforme
- Statut de vérification email
- Date de dernière connexion
- Statut de suspension
- Organisations (nom, type, rôle, archivée ?)
- Passkeys (nom, créée le, dernière utilisation)
- Consentements légaux (kind, version, date, organisation)

Indicateurs : `canSupport`, `canManage`, `isSelf`.

## Suspension

- `users.suspended_at` : timestamp nullable, posé à la suspension
- **Connexion refusée** : `SessionController` et `PasskeySessionController` refusent les comptes suspendus (message i18n `auth.suspended`)
- **Session invalidée** : `AuthMiddleware` déconnecte un compte suspendu à l'accès suivant
- **Idempotence** : suspendre un compte déjà suspendu → 409
- **Restrictions** : impossible de suspendre son propre compte ou un autre admin plateforme
- **Motif optionnel** : max 500 caractères, stocké dans `audit.changes.after.reason` (pas de colonne)

## Suppression RGPD

Réutilise la logique d'anonymisation de `AccountService.destroy` (extraite sans vérification du mot de passe) :

- Email → `deleted-{id}@promotionnal-sourcing.invalid`
- Nom, prénom → null
- Mot de passe → secret aléatoire
- Adhésions et passkeys supprimées
- Invitations en attente supprimées

**Bloquée** si l'utilisateur est dernier owner d'une organisation active (même règle que le départ volontaire).

**Audit** : action `user.deleted` avec `{ after: { anonymized: true } }` (pas d'email en clair).

## Dernière connexion

`users.last_login_at` est désormais alimenté à chaque connexion réussie (mot de passe ou passkey) via `LoginService.recordLogin`.

## Actions d'audit

| Action                          | Cible  | Description                     |
| ------------------------------- | ------ | ------------------------------- |
| `user.suspended`                | `user` | Compte suspendu                 |
| `user.reactivated`              | `user` | Compte réactivé                 |
| `user.verification_resent`      | `user` | Email de vérification renvoyé   |
| `user.password_reset_requested` | `user` | Reset de mot de passe déclenché |
| `user.deleted`                  | `user` | Compte anonymisé                |

## Migration

- `1793900000002_alter_users_add_suspended_at.ts` : ajoute `users.suspended_at` (timestamp nullable)

## Fichiers créés/modifiés

### Créés

- `app/controllers/admin/user_account_controller.ts`
- `app/services/admin_user_action_service.ts`
- `app/services/login_service.ts`
- `app/exceptions/admin_user_errors.ts`
- `app/transformers/admin_user_detail_transformer.ts`
- `shared/types/admin_user.ts`
- `database/migrations/1793900000002_alter_users_add_suspended_at.ts`

### Modifiés

- `app/controllers/admin/user_controller.ts` : show + filtres étendus
- `app/controllers/session_controller.ts` : refus suspension + lastLoginAt
- `app/controllers/passkey_session_controller.ts` : idem
- `app/middleware/auth_middleware.ts` : invalidation session suspendu
- `app/services/admin_user_service.ts` : detail + filtres + blockingOrganizations
- `app/validators/admin_user.ts` : filtres + suspension
- `shared/types/user.ts` : permissions `users.support`, `users.manage`
- `shared/types/admin_audit.ts` : nouvelles actions
- `shared/types/admin.ts` : AdminUserListItem étendu
- `database/schema.ts` : suspendedAt
- `start/routes.ts` : nouvelles routes
- `resources/lang/*/admin.json` : clés d'écran et d'audit
- `resources/lang/*/auth.json` : `auth.suspended`

## Interface (frontend)

- `inertia/pages/admin/users/index.vue` : filtres (`user_filters.vue`, validés par le bouton « Filtrer », resynchronisés avec les props serveur), liste (`user_list.vue`) avec colonnes « dernière connexion » et badge « Suspendu », lien vers la fiche.
- `inertia/pages/admin/users/show.vue` : fiche (identité, organisations, passkeys, consentements) et barre d'actions `user_actions.vue` (confirmation `window.confirm`, motif de suspension optionnel, mutations via `router.post` / `router.delete`). Les actions suivent `canSupport` / `canManage` / `isSelf` ; un compte anonymisé (`deleted-…`) n'en propose plus.
- Composable `use_user_list_visit.ts`, clés i18n `admin.users.show.*` et `admin.users.columns.lastLogin` ajoutées dans les 9 langues.
- Tests : `tests/inertia/admin_users.spec.ts`.
