# Page « mon compte » et suppression RGPD — Compte utilisateur, PR 3/3 (#45)

> Date : 2026-10-15

Un utilisateur gère son profil, son mot de passe et peut supprimer son compte.
Clôt l'issue #45 (avec les PR 1 et 2).

- **Routes** (auth, **hors `emailVerified`** : un compte non vérifié doit pouvoir
  corriger une adresse mal saisie ou supprimer son compte) — `account.show`
  (`GET /:locale/account`), `account.update` (`PATCH /account`),
  `account.password.update` (`PATCH /account/password`), `account.destroy`
  (`DELETE /account`). Lien depuis les initiales de l'en-tête.
- **Page** `account/show.vue` découpée en trois composants
  (`components/account/{profile_form,password_form,danger_zone}.vue`) : nom,
  email, langue ; mot de passe ; zone de danger.
- **Changement d'email** — remet `email_verified_at` à `NULL`, envoie le mail de
  vérification à la **nouvelle** adresse et renvoie l'utilisateur sur l'écran de
  vérification. L'unicité est insensible à la casse et exclut le compte lui-même.
- **Changement de mot de passe** — exige le mot de passe actuel (erreur de champ
  sinon) et refuse un nouveau mot de passe identique à l'ancien.
- **Suppression = anonymisation**, pas `DELETE` : des RFQ
  (`created_by_user_id`) et des invitations référencent l'utilisateur. La ligne
  `users` est conservée mais vidée — email `deleted-<id>@anonymized.invalid`,
  nom effacé, mot de passe remplacé par un secret aléatoire (connexion
  impossible), langue remise par défaut, adhésions supprimées, invitations en
  attente adressées à l'ancien email supprimées. L'adresse d'origine est libérée.
  Les demandes de devis restent, sans nom d'auteur. Exige le mot de passe actuel,
  puis déconnecte.
- **Refus pour le dernier owner** d'une organisation **non archivée**
  (`AccountService#blockingOrganizations`, même invariant que
  `OrganizationService#leave`). La page liste ces organisations et masque le
  formulaire ; une organisation archivée ne retient personne.
- **Classes** — `AccountService`, `AccountController`, `AccountTransformer`,
  validators `app/validators/account.ts`, erreurs `app/exceptions/account_errors.ts`,
  types `shared/types/account.ts` (`AccountType` est un `type`, pas une
  `interface` : DTO de page Inertia).
- **Tests** — `tests/functional/account.spec.ts` (13) et
  `tests/inertia/account.spec.ts` (6).
