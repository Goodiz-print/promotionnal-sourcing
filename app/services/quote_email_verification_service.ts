import { createHmac, timingSafeEqual } from 'node:crypto'
import { DateTime } from 'luxon'
import { signedUrlFor } from '@adonisjs/core/services/url_builder'
import env from '#start/env'
import SupplierProfile from '#models/supplier_profile'
import SendMailJob from '#jobs/send_mail_job'
import { mailSendKey } from '#shared/helpers/mail'
import { MAIL_KINDS } from '#shared/types/mail'
import {
  QUOTE_EMAIL_VERIFICATION_SIGNATURE_PURPOSE,
  QUOTE_EMAIL_VERIFICATION_TTL_HOURS,
} from '#shared/types/rfq'
import type { Locale } from '#shared/types/i18n'

/**
 * Confirmation de l'adresse de réception des demandes de devis (#217), sur le
 * modèle de `EmailVerificationService` : pas de table de jetons, le lien est
 * une URL signée (expiration + `purpose`) qui embarque une empreinte HMAC de
 * l'adresse. Si le fournisseur change d'adresse avant le clic, l'ancien lien ne
 * confirme pas la nouvelle.
 *
 * Le lien part **à l'adresse saisie** : il prouve qu'elle existe et qu'elle est
 * lue. La personne qui clique n'a pas besoin de compte (boîte partagée).
 */
export default class QuoteEmailVerificationService {
  /**
   * Envoie le lien à l'adresse de réception du profil. Sans effet si le profil
   * n'a pas d'adresse ou si elle est déjà confirmée.
   */
  async send(profile: SupplierProfile, locale: Locale): Promise<void> {
    const email = profile.quoteEmail
    if (!email || profile.quoteEmailVerifiedAt) return

    await profile.load('organization')
    await SendMailJob.dispatch({
      kind: MAIL_KINDS.quoteEmailVerification,
      idempotencyKey: mailSendKey(MAIL_KINDS.quoteEmailVerification, { profile: profile.id }),
      to: email,
      locale,
      data: {
        organizationName: profile.organization.name,
        verifyUrl: this.urlFor(profile.id, email, locale),
        expiresInHours: QUOTE_EMAIL_VERIFICATION_TTL_HOURS,
      },
    })
  }

  /**
   * Confirme l'adresse pour un lien **dont la signature est déjà vérifiée** par
   * l'appelant. Renvoie le profil, ou `null` si le lien ne correspond plus à
   * l'adresse actuelle (changée ou retirée). Idempotent.
   */
  async verify(profileId: number, fingerprint: unknown): Promise<SupplierProfile | null> {
    if (typeof fingerprint !== 'string') return null

    const profile = await SupplierProfile.find(profileId)
    const email = profile?.quoteEmail
    if (!profile || !email || !this.matches(this.fingerprint(profile.id, email), fingerprint)) {
      return null
    }

    if (!profile.quoteEmailVerifiedAt) {
      profile.quoteEmailVerifiedAt = DateTime.now()
      await profile.save()
    }
    return profile
  }

  private urlFor(profileId: number, email: string, locale: Locale): string {
    return signedUrlFor(
      'supplier.quoteEmail.verify',
      { locale, id: profileId },
      {
        expiresIn: `${QUOTE_EMAIL_VERIFICATION_TTL_HOURS}h`,
        purpose: QUOTE_EMAIL_VERIFICATION_SIGNATURE_PURPOSE,
        qs: { v: this.fingerprint(profileId, email) },
      }
    )
  }

  /** Comparaison à temps constant de deux empreintes. */
  private matches(expected: string, received: string): boolean {
    const a = Buffer.from(expected)
    const b = Buffer.from(received)
    return a.length === b.length && timingSafeEqual(a, b)
  }

  private fingerprint(profileId: number, email: string): string {
    return createHmac('sha256', env.get('APP_KEY').release())
      .update(`quote-email:${profileId}:${email.trim().toLowerCase()}`)
      .digest('hex')
  }
}
