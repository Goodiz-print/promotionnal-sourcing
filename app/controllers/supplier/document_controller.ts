import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import DocumentService from '#services/document_service'
import OrganizationContextService from '#services/organization_context_service'
import { organizationDocumentValidator } from '#validators/document'
import { DocumentNotFoundException } from '#exceptions/document_errors'

/**
 * Documents PDF du profil fournisseur (#60). Réponses en redirection Inertia.
 */
@inject()
export default class DocumentController {
  constructor(
    private documents: DocumentService,
    private organizations: OrganizationContextService
  ) {}

  async store({ auth, bouncer, request, response, i18n, session }: HttpContext) {
    const org = await this.organizations.currentFor(auth.getUserOrFail())
    await bouncer.authorize('canManageSupplierProfile', org)

    const payload = await request.validateUsing(organizationDocumentValidator)
    await this.documents.addToOrganization(org, payload.file, payload.kind)

    session.flash('success', i18n.t('documents.uploaded'))
    return response.redirect().back()
  }

  async destroy({ auth, bouncer, response, params, i18n, session }: HttpContext) {
    const org = await this.organizations.currentFor(auth.getUserOrFail())
    await bouncer.authorize('canManageSupplierProfile', org)

    const document = await this.documents.findOrganizationDocument(org, Number(params.id))
    if (!document) throw new DocumentNotFoundException()
    await this.documents.removeOrganizationDocument(document)

    session.flash('success', i18n.t('documents.deleted'))
    return response.redirect().back()
  }
}
