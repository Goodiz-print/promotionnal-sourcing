import { inject } from '@adonisjs/core'
import SupplierProfile from '#models/supplier_profile'
import QuoteEmailVerificationService from '#services/quote_email_verification_service'
import { hasQuoteEmailChanged } from '#shared/helpers/quote_address'
import type { Locale } from '#shared/types/i18n'
import type { UpdateSupplierProfileData } from '#shared/types/organization'

/**
 * Logique métier du profil fournisseur. Toute requête ORM vit ici : les
 * controllers restent fins (cf. CLAUDE.md, pas de `Model.query()` en controller).
 */
@inject()
export default class SupplierProfileService {
  constructor(private quoteEmails: QuoteEmailVerificationService) {}

  /**
   * Retourne le profil de l'organisation, ou `null` s'il n'existe pas encore.
   */
  getForOrganization(organizationId: number): Promise<SupplierProfile | null> {
    return SupplierProfile.findBy('organizationId', organizationId)
  }

  /**
   * Crée ou met à jour le profil de l'organisation (un profil par organisation).
   *
   * Une nouvelle adresse de réception (#217) n'est pas utilisée d'emblée : sa
   * confirmation est remise à zéro et un lien lui est envoyé, dans la langue de
   * celui qui la saisit. D'ici là, les demandes partent à l'adresse de contact.
   */
  async upsertForOrganization(
    organizationId: number,
    data: UpdateSupplierProfileData,
    locale: Locale
  ): Promise<SupplierProfile> {
    const profile = await SupplierProfile.firstOrNew({ organizationId })
    const quoteEmailChanged = hasQuoteEmailChanged(profile.quoteEmail ?? null, data.quoteEmail)

    profile.merge(data)
    if (quoteEmailChanged) profile.quoteEmailVerifiedAt = null
    await profile.save()

    if (quoteEmailChanged) await this.quoteEmails.send(profile, locale)
    return profile
  }

  /**
   * Renvoie le lien de confirmation de l'adresse de réception. Sans effet s'il
   * n'y a pas d'adresse ou si elle est déjà confirmée.
   */
  async resendQuoteEmailVerification(organizationId: number, locale: Locale): Promise<void> {
    const profile = await this.getForOrganization(organizationId)
    if (profile) await this.quoteEmails.send(profile, locale)
  }
}
