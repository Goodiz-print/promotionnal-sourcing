import { DateTime } from 'luxon'
import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import AgencyProfile from '#models/agency_profile'
import LegalConsent from '#models/legal_consent'
import type Organization from '#models/organization'
import User from '#models/user'
import OrganizationService from '#services/organization_service'
import VatVerifier from '#services/vat/vat_verifier'
import { emailMatchesWebsite, isFreeEmailDomain } from '#shared/helpers/email_domain'
import { resolveTaxId, type ResolvedTaxId } from '#shared/helpers/tax_id'
import type {
  AgencyReviewReason,
  AgencySignupContext,
  AgencySignupData,
  VatCheckStatus,
} from '#shared/types/agency_signup'
import { CURRENT_LEGAL_VERSION, type LegalConsentKind } from '#shared/types/legal'

export interface AgencySignupResult {
  user: User
  organization: Organization
  /** Vide : compte actif immédiatement ; sinon, motifs de la validation manuelle. */
  reviewReasons: AgencyReviewReason[]
}

/**
 * Inscription d'une agence en une étape, sans carte bancaire ni appel commercial.
 * Crée l'utilisateur, son organisation acheteur (il en est `owner`), le profil
 * agence et le journal des consentements, dans une seule transaction.
 *
 * Activation immédiate quand tout concorde : TVA (ou SIRET) confirmée par VIES,
 * email au domaine du site web, activité du secteur. Sinon l'inscription aboutit
 * quand même et l'équipe la valide ; les motifs sont conservés sur l'organisation.
 */
@inject()
export default class AgencySignupService {
  constructor(
    private organizations: OrganizationService,
    private vat: VatVerifier
  ) {}

  async register(
    data: AgencySignupData,
    context: AgencySignupContext
  ): Promise<AgencySignupResult> {
    const taxId = resolveTaxId(data.taxId)
    // Le validateur a déjà refusé une saisie illisible : ceci ne sert qu'au typage.
    if (!taxId) throw new Error('Tax id must be validated before registration')

    // Appel réseau hors transaction : on ne garde pas une connexion SQL ouverte
    // pendant que VIES répond.
    const vatStatus = await this.vat.check(taxId.countryCode, taxId.vatNumber)
    const reviewReasons = this.reviewReasons(data, vatStatus)
    const now = DateTime.now()

    return db.transaction(async (trx) => {
      const user = await User.create(
        {
          civility: data.civility,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          password: data.password,
          locale: data.locale,
        },
        { client: trx }
      )

      const organization = await this.organizations.create(
        user,
        { name: data.companyName, organizationType: 'buyer' },
        {
          client: trx,
          attributes: this.organizationAttributes(data, taxId, vatStatus, reviewReasons, now),
        }
      )

      await AgencyProfile.create(
        {
          organizationId: organization.id,
          activity: data.activity,
          activityOther: data.activity === 'other' ? data.activityOther : null,
        },
        { client: trx }
      )

      await LegalConsent.createMany(
        this.consentKinds(data).map((kind) => ({
          organizationId: organization.id,
          userId: user.id,
          kind,
          version: CURRENT_LEGAL_VERSION,
          ipAddress: context.ipAddress,
          acceptedAt: now,
        })),
        { client: trx }
      )

      return { user, organization, reviewReasons }
    })
  }

  private reviewReasons(data: AgencySignupData, vatStatus: VatCheckStatus): AgencyReviewReason[] {
    const reasons: AgencyReviewReason[] = []
    if (vatStatus !== 'valid') reasons.push('vat_unverified')
    if (data.activity === 'other') reasons.push('other_activity')

    if (!data.website) {
      reasons.push('no_website')
    } else if (isFreeEmailDomain(data.email)) {
      reasons.push('free_email_domain')
    } else if (!emailMatchesWebsite(data.email, data.website)) {
      reasons.push('domain_mismatch')
    }
    return reasons
  }

  private organizationAttributes(
    data: AgencySignupData,
    taxId: ResolvedTaxId,
    vatStatus: VatCheckStatus,
    reviewReasons: AgencyReviewReason[],
    now: DateTime
  ): Record<string, unknown> {
    const domainVerified =
      !!data.website &&
      !isFreeEmailDomain(data.email) &&
      emailMatchesWebsite(data.email, data.website)

    return {
      country: data.country,
      locale: data.locale,
      website: data.website,
      phone: data.phone,
      // L'identifiant saisi est conservé tel quel, pas converti : un SIRET reste
      // un SIRET, un numéro de TVA reste un numéro de TVA.
      siret: taxId.siret,
      vatNumber: taxId.kind === 'vat' ? `${taxId.countryCode}${taxId.vatNumber}` : null,
      vatVerifiedAt: vatStatus === 'valid' ? now : null,
      domainVerifiedAt: domainVerified ? now : null,
      reviewReasons,
    }
  }

  private consentKinds(data: AgencySignupData): LegalConsentKind[] {
    const kinds: LegalConsentKind[] = ['terms', 'professional_certification']
    if (data.acceptsPartnerCommunications) kinds.push('partner_communications')
    return kinds
  }
}
