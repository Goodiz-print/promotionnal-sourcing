import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import OrganizationContextService from '#services/organization_context_service'
import SubscriptionService from '#services/subscription_service'
import SupplierContactService from '#services/supplier_contact_service'
import SupplierContactTransformer from '#transformers/supplier_contact_transformer'
import {
  supplierContactMoveValidator,
  supplierContactSettingsValidator,
  supplierContactValidator,
} from '#validators/supplier_contact'
import type Organization from '#models/organization'
import type { SupplierContactsPageProps } from '#shared/types/supplier'

/**
 * Équipe commerciale du fournisseur (#241) : contacts, pays couverts, ordre,
 * lien facultatif vers un membre du compte, option « toute l'équipe ».
 * Mêmes droits que le profil fournisseur (owner/admin).
 */
@inject()
export default class SupplierContactsController {
  constructor(
    private contacts: SupplierContactService,
    private subscriptions: SubscriptionService,
    private organizations: OrganizationContextService
  ) {}

  async index(ctx: HttpContext) {
    const org = await this.authorize(ctx)
    const [contacts, members, showAllContacts, isSubscribed] = await Promise.all([
      this.contacts.listForOrganization(org.id),
      this.contacts.memberOptions(org.id),
      this.contacts.showsAllContacts(org.id),
      this.subscriptions.isSubscribed(org.id),
    ])

    const props: SupplierContactsPageProps = {
      contacts: contacts.map((contact) => new SupplierContactTransformer(contact).toObject()),
      members,
      showAllContacts,
      isSubscribed,
    }
    return ctx.inertia.render('supplier/contacts/index', props)
  }

  async store(ctx: HttpContext) {
    const org = await this.authorize(ctx)
    const payload = await ctx.request.validateUsing(supplierContactValidator, {
      meta: { organizationId: org.id },
    })
    await this.contacts.create(org.id, payload)
    return this.done(ctx, 'created')
  }

  async update(ctx: HttpContext) {
    const org = await this.authorize(ctx)
    const payload = await ctx.request.validateUsing(supplierContactValidator, {
      meta: { organizationId: org.id },
    })
    await this.contacts.update(org.id, Number(ctx.params.id), payload)
    return this.done(ctx, 'updated')
  }

  async destroy(ctx: HttpContext) {
    const org = await this.authorize(ctx)
    await this.contacts.destroy(org.id, Number(ctx.params.id))
    return this.done(ctx, 'deleted')
  }

  async move(ctx: HttpContext) {
    const org = await this.authorize(ctx)
    const { direction } = await ctx.request.validateUsing(supplierContactMoveValidator)
    await this.contacts.move(org.id, Number(ctx.params.id), direction)
    return ctx.response.redirect().back()
  }

  async settings(ctx: HttpContext) {
    const org = await this.authorize(ctx)
    const { showAllContacts } = await ctx.request.validateUsing(supplierContactSettingsValidator)
    await this.contacts.setShowAllContacts(org.id, showAllContacts)
    return this.done(ctx, 'settingsUpdated')
  }

  private async authorize({ auth, bouncer }: HttpContext): Promise<Organization> {
    const org = await this.organizations.currentFor(auth.getUserOrFail())
    await bouncer.authorize('canManageSupplierProfile', org)
    return org
  }

  private done({ session, i18n, response }: HttpContext, flash: string) {
    session.flash('success', i18n.t(`supplier.contacts.flash.${flash}`))
    return response.redirect().toRoute('supplier.contacts.index', { locale: i18n.locale })
  }
}
