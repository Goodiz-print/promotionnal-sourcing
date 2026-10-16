# Vérification d'email — Compte utilisateur, PR 2/3 (#45)

> Date : 2026-10-15

Un compte n'est utilisable qu'une fois son adresse email confirmée.

- **Colonne `users.email_verified_at`** (migration `…972`). Les comptes
  **existants sont marqués vérifiés** par la migration : sans ça, le déploiement
  bloquerait tous les utilisateurs actuels.
- **Mail à l'inscription** — nouveau `kind` `email-verification` de `SendMailJob`
  (`EmailVerificationNotification` + `emails/email_verification.edge`), lien signé
  valable 24 h (`EMAIL_VERIFICATION_TTL_HOURS`). Un échec de mise en queue est
  loggué en `warn` et ne défait pas l'inscription : l'écran de vérification
  propose de renvoyer le mail.
- **Routes** — `email.verify` (`GET /:locale/email/verify/:id`, lien signé,
  **hors `auth`** : il peut s'ouvrir dans un autre navigateur), `email.notice`
  (`GET /email/verify`, écran bloquant) et `email.verification.resend`
  (`POST /email/verification/resend`).
- **Lien lié à l'adresse** — l'URL embarque une empreinte HMAC (`v`) de l'email :
  changer d'adresse avant de cliquer invalide l'ancien lien.
- **Middleware `emailVerified`** — placé après `auth` et **avant** `onboarded` :
  l'onboarding, l'acceptation d'invitation et tous les écrans d'organisation
  exigent une adresse vérifiée. Déconnexion, écran de vérification et renvoi en
  sont exemptés.
- **Inscription** — redirige désormais vers `email.notice` (et non plus vers
  l'onboarding), sauf paramètre `redirect` explicite.
- **`UserFactory`** — compte vérifié par défaut, état `unverified` pour les
  specs qui portent sur la vérification. `DevUserSeeder` : compte de démo vérifié.
- **Tests** — `tests/functional/email_verification.spec.ts` (9), un test de
  `kind` dans `tests/unit/send_mail_job.spec.ts`, `tests/inertia/verify_email.spec.ts`.
  Les specs qui s'inscrivent (`auth`, `onboarding`, `organization_invitation_acceptance`)
  utilisent `mail.fake()` : en driver `sync`, le mail d'inscription tenterait
  sinon un vrai SMTP. Suite backend : 228 tests.
