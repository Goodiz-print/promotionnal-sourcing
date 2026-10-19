import Supplier from '#models/supplier'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import type { SupplierDirectoryFilters } from '#shared/types/supplier'

interface ListOptions extends SupplierDirectoryFilters {
  page: number
  perPage: number
}

/**
 * Annuaire public des fournisseurs. Toute la logique ORM vit ici (controllers
 * fins). Ne renvoie que des fiches actives, et jamais celles d'une
 * organisation archivée.
 */
export default class SupplierDirectoryService {
  /**
   * Liste paginée + filtrable (recherche par nom localisé, filtre pays).
   */
  list(options: ListOptions): Promise<ModelPaginatorContract<Supplier>> {
    const { page, perPage, search, country } = options

    return Supplier.query()
      .where('isActive', true)
      .withScopes((scopes) => scopes.fromLiveOrganization())
      .if(country, (query) => query.where('country', country!))
      .if(search, (query) =>
        query.whereHas('translations', (t) => t.whereILike('name', `%${search}%`))
      )
      .preload('translations')
      .orderBy('slug')
      .paginate(page, perPage)
  }

  /**
   * Fiche détaillée par slug : traductions, produits actifs (localisés) et
   * profil fournisseur via l'organisation liée. `null` si introuvable/inactive.
   */
  findBySlug(slug: string): Promise<Supplier | null> {
    return Supplier.query()
      .where('slug', slug)
      .where('isActive', true)
      .withScopes((scopes) => scopes.fromLiveOrganization())
      .preload('translations')
      .preload('products', (query) => query.where('isActive', true).preload('translations'))
      .preload('organization', (query) =>
        query
          .preload('supplierProfile')
          .preload('documents', (documents) =>
            documents.whereNotNull('storageObjectId').preload('storageObject').orderBy('id')
          )
      )
      .first()
  }

  /**
   * Codes pays distincts des fournisseurs actifs (pour le filtre).
   */
  async availableCountries(): Promise<string[]> {
    const rows = await Supplier.query()
      .where('isActive', true)
      .withScopes((scopes) => scopes.fromLiveOrganization())
      .distinct('country')
      .orderBy('country')

    return rows.map((row) => row.country)
  }
}
