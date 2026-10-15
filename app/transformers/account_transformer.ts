import type User from '#models/user'
import { BaseTransformer } from '@adonisjs/core/transformers'
import type { AccountType } from '#shared/types/account'
import type { Locale } from '#shared/types/i18n'

/** Compte → page « mon compte » : jamais le hash du mot de passe ni les ids. */
export default class AccountTransformer extends BaseTransformer<User> {
  toObject(): AccountType {
    return {
      ...this.pick(this.resource, ['fullName', 'email']),
      locale: this.resource.locale as Locale | null,
      isEmailVerified: this.resource.emailVerifiedAt !== null,
    }
  }
}
