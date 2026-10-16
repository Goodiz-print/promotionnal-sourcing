import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import AccountService from '#services/account_service'
import PasskeyService from '#services/passkey_service'
import PasskeyTransformer from '#transformers/passkey_transformer'
import AccountTransformer from '#transformers/account_transformer'
import {
  destroyAccountValidator,
  updateAccountValidator,
  updatePasswordValidator,
} from '#validators/account'
import {
  AccountOwnsOrganizationsException,
  InvalidCurrentPasswordException,
} from '#exceptions/account_errors'

/**
 * Page « mon compte » : profil, mot de passe, suppression. Hors `emailVerified`
 * par construction : un compte non vérifié doit pouvoir corriger une adresse
 * mal saisie ou supprimer son compte.
 */
@inject()
export default class AccountController {
  constructor(
    private service: AccountService,
    private passkeys: PasskeyService
  ) {}

  async show({ auth, inertia }: HttpContext) {
    const user = auth.getUserOrFail()

    const passkeys = await this.passkeys.list(user)

    return inertia.render('account/show', {
      account: new AccountTransformer(user).toObject(),
      blockingOrganizations: await this.service.blockingOrganizations(user),
      passkeys: passkeys.map((passkey) => new PasskeyTransformer(passkey).toObject()),
    })
  }

  async update({ auth, request, response, session, i18n }: HttpContext) {
    const user = auth.getUserOrFail()
    const payload = await request.validateUsing(updateAccountValidator, {
      meta: { userId: user.id },
    })

    const emailChanged = await this.service.updateProfile(user, payload, i18n.locale)

    if (emailChanged) {
      session.flash('success', i18n.t('account.profile.emailChanged'))
      return response.redirect().toRoute('email.notice', { locale: payload.locale })
    }

    session.flash('success', i18n.t('account.profile.saved'))
    // La langue choisie devient celle de l'URL : on reste sur la page, traduite.
    return response.redirect().toRoute('account.show', { locale: payload.locale })
  }

  async updatePassword({ auth, request, response, session, i18n }: HttpContext) {
    const { currentPassword, password } = await request.validateUsing(updatePasswordValidator)

    try {
      await this.service.updatePassword(auth.getUserOrFail(), currentPassword, password)
    } catch (error) {
      if (!(error instanceof InvalidCurrentPasswordException)) throw error

      session.flashErrors({ currentPassword: i18n.t('account.password.wrongCurrent') })
      return response.redirect().back()
    }

    session.flash('success', i18n.t('account.password.saved'))
    return response.redirect().back()
  }

  async destroy({ auth, request, response, session, i18n }: HttpContext) {
    const user = auth.getUserOrFail()
    const { currentPassword } = await request.validateUsing(destroyAccountValidator)

    try {
      await this.service.destroy(user, currentPassword)
    } catch (error) {
      if (error instanceof InvalidCurrentPasswordException) {
        session.flashErrors({ currentPassword: i18n.t('account.password.wrongCurrent') })
      } else if (error instanceof AccountOwnsOrganizationsException) {
        session.flash(
          'error',
          i18n.t('account.danger.blocked', { names: error.organizationNames.join(', ') })
        )
      } else {
        throw error
      }
      return response.redirect().back()
    }

    await auth.use('web').logout()
    session.flash('success', i18n.t('account.danger.deleted'))
    return response.redirect().withQs(false).toRoute('home', { locale: i18n.locale })
  }
}
