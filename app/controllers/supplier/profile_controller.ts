import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { updateSupplierProfileValidator } from '#validators/supplier_profile'
import SupplierProfileService from '#services/supplier_profile_service'
import DocumentService from '#services/document_service'
import OrganizationDocumentTransformer from '#transformers/organization_document_transformer'
import SupplierProfileTransformer from '#transformers/supplier_profile_transformer'
import OrganizationContextService from '#services/organization_context_service'
import ModerationService from '#services/moderation_service'
import type { ModerationNotice } from '#shared/types/moderation'

@inject()
export default class SupplierProfileController {
  constructor(
    private service: SupplierProfileService,
    private documents: DocumentService,
    private organizations: OrganizationContextService,
    private moderation: ModerationService
  ) {}

  /**
   * Écran d'édition du profil fournisseur de l'organisation courante.
   */
  async show({ auth, bouncer, inertia }: HttpContext) {
    const org = await this.organizations.currentFor(auth.getUserOrFail())
    await bouncer.authorize('canManageSupplierProfile', org)

    const profile = await this.service.getForOrganization(org.id)
    const documents = await this.documents.listForOrganization(org)
    const [latest] = await this.moderation.history('organization', org.id).limit(1)
    const moderation: ModerationNotice = {
      status: latest ? latest.status : 'pending',
      reason: latest?.reason ?? null,
    }

    return inertia.render('supplier/profile', {
      moderation,
      profile: profile ? new SupplierProfileTransformer(profile).toObject() : null,
      documents: documents.map((document) =>
        new OrganizationDocumentTransformer(document, this.documents.urlFor).toObject()
      ),
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
