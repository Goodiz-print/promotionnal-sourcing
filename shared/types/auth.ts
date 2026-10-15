/** Durée de validité du lien de réinitialisation du mot de passe. */
export const PASSWORD_RESET_TTL_MINUTES = 60

/** `purpose` de l'URL signée de réinitialisation (cf. `PasswordResetService`). */
export const PASSWORD_RESET_SIGNATURE_PURPOSE = 'password-reset'

/** Durée de validité du lien de vérification d'email. */
export const EMAIL_VERIFICATION_TTL_HOURS = 24

/** `purpose` de l'URL signée de vérification d'email (cf. `EmailVerificationService`). */
export const EMAIL_VERIFICATION_SIGNATURE_PURPOSE = 'email-verification'
