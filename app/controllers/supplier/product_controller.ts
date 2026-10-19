import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import SupplierProductService from '#services/supplier_product_service'
import DocumentService from '#services/document_service'
import ProductTransformer from '#transformers/product_transformer'
import ProductEditTransformer from '#transformers/product_edit_transformer'
import CategoryTransformer from '#transformers/category_transformer'
import AttributeTransformer from '#transformers/attribute_transformer'
import AttributeValueTransformer from '#transformers/attribute_value_transformer'
import { ProductNotFoundException } from '#exceptions/catalogue_errors'
import {
  createSupplierProductValidator,
  updateSupplierProductValidator,
} from '#validators/supplier_product'
import type { Locale } from '#shared/types/i18n'
import OrganizationContextService from '#services/organization_context_service'

/**
 * Gestion des produits par le fournisseur (org courante). CRUD + upload
 * d'images. Controller fin : org + autorisation + validation → service.
 */
@inject()
export default class ProductController {
  constructor(
    private service: SupplierProductService,
    private documents: DocumentService,
    private organizations: OrganizationContextService
  ) {}

  /**
   * Liste des produits de l'organisation courante.
   */
  async index({ auth, bouncer, inertia, i18n }: HttpContext) {
    const org = await this.organizations.currentFor(auth.getUserOrFail())
    await bouncer.authorize('canManageProducts', org)
    const locale = i18n.locale as Locale

    const products = await this.service.listForOrg(org)

    return inertia.render('supplier/products/index', {
      products: products.map((product) => new ProductTransformer(product, locale).toObject()),
    })
  }

  /**
   * Formulaire de création.
   */
  async create({ auth, bouncer, inertia, i18n }: HttpContext) {
    const org = await this.organizations.currentFor(auth.getUserOrFail())
    await bouncer.authorize('canManageProducts', org)

    return inertia.render('supplier/products/create', await this.facetData(i18n.locale as Locale))
  }

  /**
   * Crée le produit (get-or-create du fournisseur) puis redirige vers la liste.
   */
  async store({ auth, bouncer, request, response, i18n, session }: HttpContext) {
    const org = await this.organizations.currentFor(auth.getUserOrFail())
    await bouncer.authorize('canManageProducts', org)

    const payload = await request.validateUsing(createSupplierProductValidator)
    await this.service.create(org, payload, payload.images ?? [])

    session.flash('success', i18n.t('products.manage.created'))
    return response.redirect().toRoute('supplier.products.index', { locale: i18n.locale })
  }

  /**
   * Formulaire d'édition (produit possédé par l'org).
   */
  async edit({ auth, bouncer, inertia, params, i18n }: HttpContext) {
    const org = await this.organizations.currentFor(auth.getUserOrFail())
    await bouncer.authorize('canManageProducts', org)

    const product = await this.service.findOwned(org, Number(params.id))
    if (!product) throw new ProductNotFoundException()

    return inertia.render('supplier/products/edit', {
      product: new ProductEditTransformer(product, this.documents.urlFor).toObject(),
      ...(await this.facetData(i18n.locale as Locale)),
    })
  }

  /**
   * Met à jour le produit (champs, traductions, facettes, galerie).
   */
  async update({ auth, bouncer, request, response, params, i18n, session }: HttpContext) {
    const org = await this.organizations.currentFor(auth.getUserOrFail())
    await bouncer.authorize('canManageProducts', org)

    const product = await this.service.findOwned(org, Number(params.id))
    if (!product) throw new ProductNotFoundException()

    const payload = await request.validateUsing(updateSupplierProductValidator)
    await this.service.update(product, payload, payload.images ?? [], payload.removedImageIds ?? [])

    session.flash('success', i18n.t('products.manage.updated'))
    return response.redirect().toRoute('supplier.products.index', { locale: i18n.locale })
  }

  /**
   * Supprime le produit (et planifie la purge de ses fichiers).
   */
  async destroy({ auth, bouncer, response, params, i18n, session }: HttpContext) {
    const org = await this.organizations.currentFor(auth.getUserOrFail())
    await bouncer.authorize('canManageProducts', org)

    const product = await this.service.findOwned(org, Number(params.id))
    if (!product) throw new ProductNotFoundException()

    await this.service.delete(product)

    session.flash('success', i18n.t('products.manage.deleted'))
    return response.redirect().toRoute('supplier.products.index', { locale: i18n.locale })
  }

  /**
   * Données de facettes du formulaire : catégories + attributs filtrables.
   */
  private async facetData(locale: Locale) {
    const categories = await this.service.allCategories()
    const attributes = await this.service.filterableAttributes()

    return {
      categories: categories.map((category) =>
        new CategoryTransformer(category, locale).toObject()
      ),
      attributes: attributes.map((attribute) => ({
        ...new AttributeTransformer(attribute, locale).toObject(),
        values: attribute.values.map((value) =>
          new AttributeValueTransformer(value, locale).toObject()
        ),
      })),
    }
  }
}
