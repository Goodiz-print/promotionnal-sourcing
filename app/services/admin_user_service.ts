import { DateTime } from 'luxon'
import { inject } from '@adonisjs/core'
import User from '#models/user'
import LegalConsent from '#models/legal_consent'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import type { AdminUserIndexFilters } from '#shared/types/admin_user'

/** Jours depuis la dernière connexion pour être considéré « actif ». */
const RECENT_LOGIN_DAYS = 30

interface ListOptions extends AdminUserIndexFilters {
  page: number
  perPage: number
}

/**
 * Consultation des comptes utilisateurs par l'équipe plateforme (#160).
 * Ne contient que la lecture ; les actions (suspension, suppression…) sont
 * dans `AdminUserActionService`.
 */
@inject()
export default class AdminUserService {
  find(id: number): Promise<User | null> {
    return User.find(id)
  }

  /**
   * Charge un utilisateur avec toutes ses relations pour la fiche :
   * organisations (avec rôle), passkeys, consentements légaux.
   */
  async detail(id: number): Promise<User | null> {
    const user = await User.query()
      .where('id', id)
      .preload('organizationUsers', (query) =>
        query.preload('organization').preload('role').orderBy('joinedAt', 'asc')
      )
      .preload('passkeys', (query) => query.orderBy('createdAt', 'asc'))
      .first()

    if (!user) return null

    // Consentements légaux : chargés séparément car le modèle User n'a pas la
    // relation (les consentements sont par organisation, pas par utilisateur).
    const consents = await LegalConsent.query()
      .where('userId', user.id)
      .preload('organization')
      .orderBy('acceptedAt', 'desc')

    user.$extras.consents = consents
    return user
  }

  /**
   * Liste paginée avec filtres étendus (#160) :
   * - `search` : email partiel (ILIKE)
   * - `platformRole` : rôle plateforme exact ou `any-role` (tout sauf `none`)
   * - `emailVerified` : `verified` ou `unverified`
   * - `activity` : `recent` (connexion < 30 jours) ou `never` (jamais connecté)
   * - `organizationType` : type d'une des organisations de l'utilisateur
   * - `status` : `active` ou `suspended`
   */
  list(options: ListOptions): Promise<ModelPaginatorContract<User>> {
    const {
      page,
      perPage,
      search,
      platformRole,
      emailVerified,
      activity,
      organizationType,
      status,
    } = options

    return User.query()
      .withCount('organizationUsers', (query) => query.as('organizations_count'))
      .if(search, (query) => query.whereILike('email', `%${escapeLike(search!)}%`))
      .if(platformRole === 'any-role', (query) => query.whereNot('platformRole', 'none'))
      .if(platformRole && platformRole !== 'any-role', (query) =>
        query.where('platformRole', platformRole!)
      )
      .if(emailVerified === 'verified', (query) => query.whereNotNull('emailVerifiedAt'))
      .if(emailVerified === 'unverified', (query) => query.whereNull('emailVerifiedAt'))
      .if(activity === 'recent', (query) =>
        query.where(
          'lastLoginAt',
          '>=',
          DateTime.now().minus({ days: RECENT_LOGIN_DAYS }).toJSDate()
        )
      )
      .if(activity === 'never', (query) => query.whereNull('lastLoginAt'))
      .if(organizationType, (query) =>
        query.whereHas('organizationUsers', (subQuery) =>
          subQuery.whereHas('organization', (orgQuery) =>
            orgQuery.where('organizationType', organizationType!)
          )
        )
      )
      .if(status === 'active', (query) => query.whereNull('suspendedAt'))
      .if(status === 'suspended', (query) => query.whereNotNull('suspendedAt'))
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
