import type UserLoggedIn from '#events/user_logged_in'
import logger from '@adonisjs/core/services/logger'

export default class OnUserLoggedIn {
  async handle(event: UserLoggedIn) {
    logger.info({ userId: event.user.id, email: event.user.email }, 'user logged in')
  }
}
