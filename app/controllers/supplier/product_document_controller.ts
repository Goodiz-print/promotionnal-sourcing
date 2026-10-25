import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import DocumentService from '#services/document_service'
import SupplierProductService from '#services/supplier_product_service'
import OrganizationContextService from '#services/organization_context_service'
import { ProductNotFoundException } from '#exceptions/catalogue_errors'
import { DocumentNotFoundException } from '#exceptions/document_errors'
import { productDocumentValidator } from '#validators/document'

/**
 * Fiches techniques PDF d'un produit du fournisseur (#60).
 */
@inject()
export default class ProductDocumentController {
  constructor(
    private documents: DocumentService,
    private products: SupplierProductService,
    private organizations: OrganizationContextService
  ) {}

  async store({ auth, bouncer, request, response, params, i18n, session }: HttpContext) {
    const org = await this.organizations.currentFor(auth.getUserOrFail())
    await bouncer.authorize('canManageProducts', org)

    const product = await this.products.findOwned(org, Number(params.id))
    if (!product) throw new ProductNotFoundException()

    const payload = await request.validateUsing(productDocumentValidator)
    await this.documents.addToProduct(product, payload.file, payload.type)

    session.flash('success', i18n.t('documents.uploaded'))
    return response.redirect().back()
  }

  async destroy({ auth, bouncer, response, params, i18n, session }: HttpContext) {
    const org = await this.organizations.currentFor(auth.getUserOrFail())
    await bouncer.authorize('canManageProducts', org)

    const product = await this.products.findOwned(org, Number(params.id))
    if (!product) throw new ProductNotFoundException()

    const document = await this.documents.findProductDocument(product, Number(params.documentId))
    if (!document) throw new DocumentNotFoundException()
    await this.documents.removeProductDocument(document)

    session.flash('success', i18n.t('documents.deleted'))
    return response.redirect().back()
  }
}
