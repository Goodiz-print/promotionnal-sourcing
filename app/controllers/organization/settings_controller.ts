import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import { updateOrganizationValidator } from '#validators/organization'
import OrganizationService from '#services/organization_service'
import OrganizationTransformer from '#transformers/organization_transformer'
import type Organization from '#models/organization'
import type User from '#models/user'

/**
 * Paramètres généraux de l'organisation courante (nom, coordonnées, adresse,
 * logo). Accessible à toute organisation (buyer/supplier/both), réservé aux
 * owner/admin (`canManageOrganization`). Le slug n'est pas modifiable ici.
 */
@inject()
export default class OrganizationSettingsController {
  constructor(private service: OrganizationService) {}

  /**
   * Écran d'édition des paramètres généraux de l'organisation courante.
   */
  async show({ auth, bouncer, inertia }: HttpContext) {
    const org = await this.currentOrganization(auth.getUserOrFail())
    await bouncer.authorize('canManageOrganization', org)

    return inertia.render('organization/settings', {
      organization: new OrganizationTransformer(org).toObject(),
    })
  }

  /**
   * Met à jour les champs texte, et le logo si un fichier est fourni (ou le
   * supprime si `removeLogo` est coché). POST (et non PATCH) pour porter le
   * corps multipart de l'upload.
   */
  async update({ auth, bouncer, request, response, i18n, session }: HttpContext) {
    const org = await this.currentOrganization(auth.getUserOrFail())
    await bouncer.authorize('canManageOrganization', org)

    const { logo, removeLogo, ...data } = await request.validateUsing(updateOrganizationValidator)

    await this.service.update(org, data)
    if (logo) {
      await this.service.updateLogo(org, logo)
    } else if (removeLogo) {
      await this.service.removeLogo(org)
    }

    session.flash('success', i18n.t('organization.settings.success'))
    return response.redirect().toRoute('organization.settings', { locale: i18n.locale })
  }

  /**
   * Charge l'organisation courante de l'utilisateur (relation, pas de
   * `Model.query()` en controller). 403 si absente.
   */
  private async currentOrganization(user: User): Promise<Organization> {
    await user.load('currentOrganization')
    if (!user.currentOrganization) {
      throw new Exception('No current organization', { status: 403, code: 'E_NO_CURRENT_ORG' })
    }
    return user.currentOrganization
  }
}
