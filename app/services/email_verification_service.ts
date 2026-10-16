import { createHmac, timingSafeEqual } from 'node:crypto'
import { DateTime } from 'luxon'
import { signedUrlFor } from '@adonisjs/core/services/url_builder'
import env from '#start/env'
import User from '#models/user'
import SendMailJob from '#jobs/send_mail_job'
import { MAIL_KINDS } from '#shared/types/mail'
import {
  EMAIL_VERIFICATION_SIGNATURE_PURPOSE,
  EMAIL_VERIFICATION_TTL_HOURS,
} from '#shared/types/auth'

/**
 * Vérification d'adresse **sans table** : le lien est une URL signée AdonisJS
 * (expiration + `purpose`), comme les invitations et la réinitialisation de mot
 * de passe.
 *
 * Elle embarque une empreinte HMAC (`v`) de l'adresse : si l'utilisateur change
 * d'email avant de cliquer, l'ancien lien ne vérifie pas la nouvelle adresse.
 */
export default class EmailVerificationService {
  /** Envoie (ou renvoie) le mail de vérification. Sans effet si déjà vérifié. */
  async send(user: User, locale: string): Promise<void> {
    if (user.emailVerifiedAt) return

    const verifyUrl = signedUrlFor(
      'email.verify',
      { locale, id: user.id },
      {
        expiresIn: `${EMAIL_VERIFICATION_TTL_HOURS}h`,
        purpose: EMAIL_VERIFICATION_SIGNATURE_PURPOSE,
        qs: { v: this.fingerprint(user) },
      }
    )

    await SendMailJob.dispatch({
      kind: MAIL_KINDS.emailVerification,
      to: user.email,
      data: { verifyUrl, expiresInHours: EMAIL_VERIFICATION_TTL_HOURS },
    })
  }

  /**
   * Marque l'adresse comme vérifiée pour un lien **dont la signature est déjà
   * vérifiée** par l'appelant. Retourne le compte, ou `null` si le lien est
   * périmé (adresse changée) ou le compte supprimé. Idempotent.
   */
  async verify(id: number, fingerprint: unknown): Promise<User | null> {
    if (typeof fingerprint !== 'string') return null

    const user = await User.find(id)
    if (!user) return null

    const expected = Buffer.from(this.fingerprint(user))
    const received = Buffer.from(fingerprint)
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null

    if (!user.emailVerifiedAt) {
      user.emailVerifiedAt = DateTime.now()
      await user.save()
    }
    return user
  }

  private fingerprint(user: User): string {
    return createHmac('sha256', env.get('APP_KEY').release())
      .update(`email-verification:${user.id}:${user.email.toLowerCase()}`)
      .digest('hex')
  }
}
