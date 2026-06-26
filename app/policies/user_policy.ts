import User from '#models/user'
import { BasePolicy } from '@adonisjs/bouncer'
import { AuthorizerResponse } from '@adonisjs/bouncer/types'

/**
 * Policy for User resource authorization.
 *
 * Policies group related authorization checks for a specific resource.
 * Use policies when you need to authorize actions on model instances.
 *
 * @example Usage in controller:
 * ```ts
 * import UserPolicy from '#policies/user_policy'
 *
 * async show({ bouncer, params }: HttpContext) {
 *   const user = await User.findOrFail(params.id)
 *   await bouncer.with(UserPolicy).authorize('view', user)
 *   return user
 * }
 * ```
 */
export default class UserPolicy extends BasePolicy {
  /**
   * Check if user can view another user's profile.
   * Currently allows all authenticated users.
   */
  view(_currentUser: User, _targetUser: User): AuthorizerResponse {
    return true
  }

  /**
   * Check if user can update another user's profile.
   * Only allows users to update their own profile.
   */
  update(currentUser: User, targetUser: User): AuthorizerResponse {
    return currentUser.id === targetUser.id
  }

  /**
   * Check if user can delete another user's profile.
   * Only allows users to delete their own profile.
   */
  delete(currentUser: User, targetUser: User): AuthorizerResponse {
    return currentUser.id === targetUser.id
  }
}
