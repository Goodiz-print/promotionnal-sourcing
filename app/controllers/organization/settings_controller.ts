import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { updateOrganizationValidator } from '#validators/organization'
import OrganizationService from '#services/organization_service'
import OrganizationTransformer from '#transformers/organization_transformer'
import OrganizationContextService from '#services/organization_context_service'

/**
 * Paramètres généraux de l'organisation courante (nom, coordonnées, adresse,
 * logo). Accessible à toute organisation (buyer/supplier/both), réservé aux
 * owner/admin (`canManageOrganization`). Le slug n'est pas modifiable ici.
 */
@inject()
export default class OrganizationSettingsController {
  constructor(
    private service: OrganizationService,
    private organizations: OrganizationContextService
  ) {}

  /**
   * Écran d'édition des paramètres généraux de l'organisation courante.
   */
  async show({ auth, bouncer, inertia }: HttpContext) {
    const user = auth.getUserOrFail()
    const org = await this.organizations.currentFor(user)
    await bouncer.authorize('canManageOrganization', org)

    return inertia.render('organization/settings', {
      organization: new OrganizationTransformer(org).toObject(),
      // Masque le bouton « quitter » pour le dernier owner (le refus reste
      // appliqué côté service).
      canLeave: await this.service.canLeave(user, org),
    })
  }

  /**
   * Met à jour les champs texte, et le logo si un fichier est fourni (ou le
   * supprime si `removeLogo` est coché). POST (et non PATCH) pour porter le
   * corps multipart de l'upload.
   */
  async update({ auth, bouncer, request, response, i18n, session }: HttpContext) {
    const org = await this.organizations.currentFor(auth.getUserOrFail())
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
}
