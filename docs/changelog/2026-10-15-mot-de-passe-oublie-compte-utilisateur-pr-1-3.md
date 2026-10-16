# Mot de passe oublié — Compte utilisateur, PR 1/3 (#45)

> Date : 2026-10-15

Un utilisateur qui a perdu son mot de passe peut en choisir un nouveau par mail.

- **Routes `guest`** — `password.forgot` / `password.email` (`GET`/`POST
/:locale/password/forgot`) et `password.reset` / `password.update` (`GET`/`POST
/:locale/password/reset/:id`). Lien « Mot de passe oublié ? » depuis `login.vue`,
  pages `auth/forgot_password.vue` et `auth/reset_password.vue`.
- **Sans table** — le lien est une URL signée AdonisJS (`purpose: password-reset`,
  validité 60 min, `PASSWORD_RESET_TTL_MINUTES`). Le paramètre de route est `:id`
  (le compte visé) et non `:token` comme l'esquissait l'issue : aucun token n'est
  stocké.
- **Lien à usage unique** — l'URL embarque une empreinte HMAC (`v`) du hash du
  mot de passe courant ; dès que le mot de passe change, l'empreinte ne
  correspond plus et le lien est mort. La signature couvre la querystring.
- **Pas d'énumération de comptes** — la demande répond pareil que l'email existe
  ou non ; un email inconnu n'envoie rien. Un lien invalide ou périmé redirige
  vers « mot de passe oublié » avec un message.
- **Mail** — nouveau `kind` `password-reset` de `SendMailJob`
  (`PasswordResetNotification` + `emails/password_reset.edge`).
- **Services** — `PasswordResetService` (`request`, `resolve`, `reset`),
  validators `app/validators/password.ts`, constantes dans `shared/types/auth.ts`.
- **Tests** — `tests/functional/password_reset.spec.ts` (7), un test de
  reconstruction du `kind` dans `tests/unit/send_mail_job.spec.ts`,
  `tests/inertia/password_reset.spec.ts` (2).
