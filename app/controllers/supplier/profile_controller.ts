import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { updateSupplierProfileValidator } from '#validators/supplier_profile'
import SupplierProfileService from '#services/supplier_profile_service'
import SupplierProfileTransformer from '#transformers/supplier_profile_transformer'
import OrganizationContextService from '#services/organization_context_service'

@inject()
export default class SupplierProfileController {
  constructor(
    private service: SupplierProfileService,
    private organizations: OrganizationContextService
  ) {}

  /**
   * Écran d'édition du profil fournisseur de l'organisation courante.
   */
  async show({ auth, bouncer, inertia }: HttpContext) {
    const org = await this.organizations.currentFor(auth.getUserOrFail())
    await bouncer.authorize('canManageSupplierProfile', org)

    const profile = await this.service.getForOrganization(org.id)

    return inertia.render('supplier/profile', {
      profile: profile ? new SupplierProfileTransformer(profile).toObject() : null,
    })
  }

  /**
   * Crée ou met à jour le profil fournisseur de l'organisation courante.
   */
  async update({ auth, bouncer, request, response, i18n, session }: HttpContext) {
    const org = await this.organizations.currentFor(auth.getUserOrFail())
    await bouncer.authorize('canManageSupplierProfile', org)

    const payload = await request.validateUsing(updateSupplierProfileValidator)
    await this.service.upsertForOrganization(org.id, payload)

    session.flash('success', i18n.t('supplier.profile.success'))
    return response.redirect().toRoute('supplier.profile', { locale: i18n.locale })
  }
}
