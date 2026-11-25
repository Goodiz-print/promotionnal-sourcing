# Liens des mails de compte absolus

> Date : 2026-11-25

Le lien du mail de vérification d'inscription était relatif (`/fr/email/verify/…?signature=…`) : ouvert depuis une messagerie, il ne menait nulle part (#288). Trois autres liens signés avaient le même défaut : confirmation de l'adresse de réception des devis (`supplier/quote-email/verify/:id`, #217), réinitialisation du mot de passe (`password/reset/:id`) et invitation dans une organisation (`organization/invitations/:id/accept`).

- Nouveau helper `absoluteUrl(path, baseUrl)` (`shared/helpers/http.ts`) : préfixe un chemin par l'URL publique de l'application ; un lien déjà absolu est rendu tel quel.
- `EmailVerificationService`, `QuoteEmailVerificationService`, `PasswordResetService` et `OrganizationInvitationsService` construisent l'URL signée (`signedUrlFor`) puis la préfixent par `APP_URL`. La signature porte sur le chemin et la querystring : elle reste valide.
- Tests : `tests/unit/http_helpers.spec.ts` (helper), `tests/functional/email_verification.spec.ts`, `supplier_quote_email.spec.ts`, `password_reset.spec.ts` et `organization_invitations.spec.ts` (le lien reçu commence par l'origine de `APP_URL` ; les parcours qui l'ouvrent ensuite passent toujours).
