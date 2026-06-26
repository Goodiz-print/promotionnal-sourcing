/*
|--------------------------------------------------------------------------
| Bouncer abilities
|--------------------------------------------------------------------------
|
| You may export multiple abilities from this file and pre-register them
| when creating the Bouncer instance.
|
| Pre-registered policies and abilities can be referenced as a string by their
| name. Also they are must if want to perform authorization inside Edge
| templates.
|
*/

import { Bouncer } from '@adonisjs/bouncer'
import User from '#models/user'

/**
 * Ability to check if user is authenticated
 */
export const isAuthenticated = Bouncer.ability((user: User | null) => {
  return !!user
})

/**
 * Ability to check if user can edit their own profile.
 * Can be extended to check a `role` field when added to the User model.
 *
 * @example Add a role field to users table:
 * ```ts
 * // In migration
 * table.string('role').notNullable().defaultTo('user')
 *
 * // Then update this ability:
 * export const adminAbility = Bouncer.ability((user: User) => {
 *   return user.role === 'admin'
 * })
 * ```
 */
export const editOwnProfile = Bouncer.ability((user: User, targetUserId: number) => {
  return user.id === targetUserId
})
