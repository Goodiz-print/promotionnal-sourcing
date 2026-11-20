import { BaseTransformer } from '@adonisjs/core/transformers'
import type { AdminOrganizationDetails } from '#services/admin_organization_service'
import type {
  AdminOrganizationDetail,
  AdminOrganizationMember,
  AdminOrganizationInvitation,
  AdminOrganizationSupplierProfile,
  AdminOrganizationAgencyProfile,
  AdminOrganizationBillingProfile,
  AdminOrganizationSubscription,
} from '#shared/types/admin_organization'
import type { RoleSlug } from '#shared/types/role'

interface TransformOptions {
  canManage: boolean
}

/**
 * Fiche d'une organisation du back-office : colonnes de la liste + contact,
 * identifiants legaux, volumes, membres, invitations et profils.
 */
export default class AdminOrganizationDetailTransformer extends BaseTransformer<AdminOrganizationDetails> {
  constructor(
    resource: AdminOrganizationDetails,
    private options: TransformOptions
  ) {
    super(resource)
  }

  toObject(): AdminOrganizationDetail {
    const {
      organization,
      members,
      pendingInvitations,
      productsCount,
      rfqsCount,
      supplierProfile,
      agencyProfile,
      billingProfile,
      subscriptions,
      lastActivity,
    } = this.resource

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      organizationType: organization.organizationType,
      country: organization.country,
      membersCount: Number(organization.$extras.members_count ?? members.length),
      archivedAt: organization.archivedAt?.toISO() ?? null,
      createdAt: organization.createdAt.toISO()!,
      lastActivity: lastActivity?.toISOString() ?? null,
      email: organization.email,
      phone: organization.phone,
      website: organization.website,
      siret: organization.siret,
      vatNumber: organization.vatNumber,
      industry: organization.industry,
      size: organization.size,
      description: organization.description,
      addressLine1: organization.addressLine1,
      addressLine2: organization.addressLine2,
      city: organization.city,
      postalCode: organization.postalCode,
      logoUrl: organization.logoUrl,
      subscriptionPlan: organization.subscriptionPlan,
      subscriptions: subscriptions.map((subscription) => this.transformSubscription(subscription)),
      locale: organization.locale,
      updatedAt: organization.updatedAt?.toISO() ?? null,
      reviewReasons: organization.reviewReasons?.length > 0 ? organization.reviewReasons : null,
      vatVerifiedAt: organization.vatVerifiedAt?.toISO() ?? null,
      domainVerifiedAt: organization.domainVerifiedAt?.toISO() ?? null,
      productsCount,
      rfqsCount,
      members: members.map((membership): AdminOrganizationMember => ({
        id: membership.user.id,
        membershipId: membership.id,
        email: membership.user.email,
        fullName: membership.user.fullName,
        roleSlug: membership.role.slug as RoleSlug,
        joinedAt: membership.joinedAt.toISO()!,
      })),
      pendingInvitations: pendingInvitations.map((inv): AdminOrganizationInvitation => ({
        id: inv.id,
        email: inv.email,
        roleSlug: inv.role.slug as RoleSlug,
        expiresAt: inv.expiresAt.toISO()!,
        invitedByEmail: inv.invitedBy?.email ?? null,
        invitedByName: inv.invitedBy?.fullName ?? null,
      })),
      supplierProfile: supplierProfile ? this.transformSupplierProfile(supplierProfile) : null,
      agencyProfile: agencyProfile ? this.transformAgencyProfile(agencyProfile) : null,
      billingProfile: billingProfile ? this.transformBillingProfile(billingProfile) : null,
      canManage: this.options.canManage,
    }
  }

  private transformSupplierProfile(
    profile: NonNullable<AdminOrganizationDetails['supplierProfile']>
  ): AdminOrganizationSupplierProfile {
    return {
      id: profile.id,
      minOrderQuantity: profile.minOrderQuantity,
      deliveryDays: profile.deliveryDays,
      deliveryScope: profile.deliveryScope,
      certifications: profile.certifications,
      bio: profile.bio,
      responseTimeDays: profile.responseTimeDays,
      companyType: profile.companyType,
      deliveryCountries: profile.deliveryCountries,
      spokenLanguages: profile.spokenLanguages,
      reportFrequency: profile.reportFrequency,
      catalogueUpdateMode: profile.catalogueUpdateMode,
      catalogueUpdateFrequency: profile.catalogueUpdateFrequency,
      defaultOriginScope: profile.defaultOriginScope,
      isFoundingPartner: profile.isFoundingPartner,
      commercialStatus: profile.commercialStatus,
      createdAt: profile.createdAt.toISO()!,
      updatedAt: profile.updatedAt?.toISO() ?? null,
    }
  }

  private transformAgencyProfile(
    profile: NonNullable<AdminOrganizationDetails['agencyProfile']>
  ): AdminOrganizationAgencyProfile {
    return {
      id: profile.id,
      activity: profile.activity,
      activityOther: profile.activityOther,
      teamSize: profile.teamSize,
      purchaseVolume: profile.purchaseVolume,
      clientSectors: profile.clientSectors,
      defaultMarginPercent: profile.defaultMarginPercent,
      createdAt: profile.createdAt.toISO()!,
      updatedAt: profile.updatedAt?.toISO() ?? null,
    }
  }

  private transformSubscription(
    subscription: AdminOrganizationDetails['subscriptions'][number]
  ): AdminOrganizationSubscription {
    return {
      id: subscription.id,
      plan: subscription.plan,
      status: subscription.status,
      origin: subscription.origin,
      startsAt: subscription.startsAt.toISO()!,
      endsAt: subscription.endsAt?.toISO() ?? null,
      cancelledAt: subscription.cancelledAt?.toISO() ?? null,
      createdByEmail: subscription.createdBy?.email ?? null,
      createdAt: subscription.createdAt.toISO()!,
      editable:
        subscription.stripeSubscriptionId === null &&
        (subscription.status === 'active' || subscription.status === 'scheduled'),
    }
  }

  private transformBillingProfile(
    profile: NonNullable<AdminOrganizationDetails['billingProfile']>
  ): AdminOrganizationBillingProfile {
    return {
      id: profile.id,
      email: profile.email,
      addressLine1: profile.addressLine1,
      addressLine2: profile.addressLine2,
      city: profile.city,
      postalCode: profile.postalCode,
      country: profile.country,
      purchaseOrderReference: profile.purchaseOrderReference,
      // stripeCustomerId omis : secret
      createdAt: profile.createdAt.toISO()!,
      updatedAt: profile.updatedAt?.toISO() ?? null,
    }
  }
}
