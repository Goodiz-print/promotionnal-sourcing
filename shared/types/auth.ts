/** Durée de validité du lien de réinitialisation du mot de passe. */
export const PASSWORD_RESET_TTL_MINUTES = 60

/** `purpose` de l'URL signée de réinitialisation (cf. `PasswordResetService`). */
export const PASSWORD_RESET_SIGNATURE_PURPOSE = 'password-reset'

/** Durée de validité du lien de vérification d'email. */
export const EMAIL_VERIFICATION_TTL_HOURS = 24

/** `purpose` de l'URL signée de vérification d'email (cf. `EmailVerificationService`). */
export const EMAIL_VERIFICATION_SIGNATURE_PURPOSE = 'email-verification'

/** Requête refusée faute de session, d'où l'on calcule la page de connexion. */
export interface LoginRedirectSource {
  /** Langue de la requête : la page de connexion est localisée. */
  locale: string
  method: string
  /** Chemin demandé, query string comprise. */
  path: string
  /**
   * Navigation d'une page (Inertia, ou réponse HTML attendue), par opposition
   * à un appel qui attend du JSON : seule une navigation est reprise après la
   * connexion.
   */
  isNavigation: boolean
}
