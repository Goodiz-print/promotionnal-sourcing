import type { Locale } from '#shared/types/i18n'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { signedUrlFor } from '@adonisjs/core/services/url_builder'
import env from '#start/env'
import User from '#models/user'
import SendMailJob from '#jobs/send_mail_job'
import { mailSendKey } from '#shared/helpers/mail'
import { absoluteUrl } from '#shared/helpers/http'
import { MAIL_KINDS } from '#shared/types/mail'
import { PASSWORD_RESET_SIGNATURE_PURPOSE, PASSWORD_RESET_TTL_MINUTES } from '#shared/types/auth'

/**
 * Réinitialisation du mot de passe **sans table** : le lien est une URL signée
 * AdonisJS (expiration + `purpose`), comme les invitations.
 *
 * Un lien signé seul serait rejouable jusqu'à son expiration. On le rend à
 * usage unique en y embarquant une empreinte (`v`) du hash du mot de passe
 * courant : dès que le mot de passe change, l'empreinte ne correspond plus et
 * le lien est mort. La signature couvre la querystring, `v` n'est donc pas
 * falsifiable.
 */
export default class PasswordResetService {
  /**
   * Envoie le mail de réinitialisation si un compte existe pour cet email.
   * Ne révèle jamais si le compte existe (l'appelant répond pareil dans les
   * deux cas) : un email inconnu est ignoré en silence.
   */
  async request(email: string, locale: string): Promise<void> {
    const user = await User.query()
      .select('id', 'email', 'password')
      .whereRaw('lower(email) = ?', [email.toLowerCase()])
      .first()
    if (!user) return

    const resetPath = signedUrlFor(
      'password.reset',
      { locale, id: user.id },
      {
        expiresIn: `${PASSWORD_RESET_TTL_MINUTES}m`,
        purpose: PASSWORD_RESET_SIGNATURE_PURPOSE,
        qs: { v: this.fingerprint(user) },
      }
    )
    // Le lien part par mail : il doit porter le domaine de l'application (#288).
    const resetUrl = absoluteUrl(resetPath, env.get('APP_URL', 'http://localhost:5555'))

    await SendMailJob.dispatch({
      kind: MAIL_KINDS.passwordReset,
      idempotencyKey: mailSendKey(MAIL_KINDS.passwordReset, { user: user.id }),
      to: user.email,
      locale: locale as Locale,
      data: { resetUrl, expiresInMinutes: PASSWORD_RESET_TTL_MINUTES },
    })
  }

  /**
   * Résout le compte visé par un lien **dont la signature est déjà vérifiée**
   * par l'appelant, ou `null` si le lien est périmé (mot de passe déjà changé)
   * ou le compte supprimé.
   */
  async resolve(id: number, fingerprint: unknown): Promise<User | null> {
    if (typeof fingerprint !== 'string') return null

    const user = await User.find(id)
    if (!user) return null

    const expected = Buffer.from(this.fingerprint(user))
    const received = Buffer.from(fingerprint)
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null

    return user
  }

  async reset(user: User, password: string): Promise<void> {
    user.password = password
    await user.save()
  }

  private fingerprint(user: User): string {
    return createHmac('sha256', env.get('APP_KEY').release())
      .update(`password-reset:${user.id}:${user.password}`)
      .digest('hex')
  }
}
