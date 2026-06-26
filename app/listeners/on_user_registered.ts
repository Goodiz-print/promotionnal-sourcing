import type UserRegistered from '#events/user_registered'
import logger from '@adonisjs/core/services/logger'

export default class OnUserRegistered {
  async handle(event: UserRegistered) {
    logger.info({ userId: event.user.id, email: event.user.email }, 'user registered')
  }
}
