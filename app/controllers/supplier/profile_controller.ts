import type { HttpContext } from '@adonisjs/core/http'
import { Exception } from '@adonisjs/core/exceptions'
import { updateSupplierProfileValidator } from '#validators/supplier_profile'
import SupplierProfileService from '#services/supplier_profile_service'
import SupplierProfileTransformer from '#transformers/supplier_profile_transformer'
import type Organization from '#models/organization'
import type User from '#models/user'

export default class SupplierProfileController {
  private service = new SupplierProfileService()

  /**
   * Écran d'édition du profil fournisseur de l'organisation courante.
   */
  async show({ auth, bouncer, inertia }: HttpContext) {
    const org = await this.currentOrganization(auth.getUserOrFail())
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
    const org = await this.currentOrganization(auth.getUserOrFail())
    await bouncer.authorize('canManageSupplierProfile', org)

    const payload = await request.validateUsing(updateSupplierProfileValidator)
    await this.service.upsertForOrganization(org.id, payload)

    session.flash('success', i18n.t('supplier.profile.success'))
    return response.redirect().toRoute('supplier.profile', { locale: i18n.locale })
  }

  /**
   * Charge l'organisation courante de l'utilisateur (relation, pas de
   * `Model.query()` en controller). L'ability rejette une org non fournisseur.
   */
  private async currentOrganization(user: User): Promise<Organization> {
    await user.load('currentOrganization')
    if (!user.currentOrganization) {
      throw new Exception('No current organization', { status: 403, code: 'E_NO_CURRENT_ORG' })
    }
    return user.currentOrganization
  }
}
