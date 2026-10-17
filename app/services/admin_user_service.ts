import User from '#models/user'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import type { AdminUserFilters } from '#shared/types/admin'

interface ListOptions extends AdminUserFilters {
  page: number
  perPage: number
}

/**
 * Consultation des comptes utilisateurs par l'équipe plateforme.
 */
export default class AdminUserService {
  /**
   * Liste paginée, recherche partielle sur l'email, avec le nombre
   * d'organisations de chaque compte (`$extras.organizations_count`).
   */
  list(options: ListOptions): Promise<ModelPaginatorContract<User>> {
    const { page, perPage, search } = options

    return User.query()
      .withCount('organizationUsers', (query) => query.as('organizations_count'))
      .if(search, (query) => query.whereILike('email', `%${escapeLike(search!)}%`))
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')
      .paginate(page, perPage)
  }
}

/**
 * Neutralise les jokers `%` et `_` (et l'échappement) d'une saisie utilisateur
 * avant de l'insérer dans un motif `ILIKE`.
 */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}
