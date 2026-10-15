import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import PasskeyService from '#services/passkey_service'
import {
  PasskeyAlreadyRegisteredException,
  PasskeyVerificationFailedException,
} from '#exceptions/passkey_errors'
import { registerPasskeyValidator, renamePasskeyValidator } from '#validators/passkey'

/**
 * Passkeys du compte connecté (page « mon compte »). Hors `emailVerified`, comme
 * le reste de la page. Seule `options` répond en JSON : le navigateur en a besoin
 * pour lancer la cérémonie WebAuthn avant de soumettre le résultat via Inertia.
 */
@inject()
export default class PasskeyController {
  constructor(private service: PasskeyService) {}

  async options({ auth, session, response }: HttpContext) {
    return response.json(await this.service.registrationOptions(auth.getUserOrFail(), session))
  }

  async store({ auth, request, response, session, i18n }: HttpContext) {
    const { credential, name } = await request.validateUsing(registerPasskeyValidator)

    try {
      await this.service.register(auth.getUserOrFail(), session, credential, name)
    } catch (error) {
      if (error instanceof PasskeyAlreadyRegisteredException) {
        session.flashErrors({ credential: i18n.t('account.passkeys.alreadyRegistered') })
      } else if (error instanceof PasskeyVerificationFailedException) {
        session.flashErrors({ credential: i18n.t('account.passkeys.failed') })
      } else {
        throw error
      }
      return response.redirect().back()
    }

    session.flash('success', i18n.t('account.passkeys.added'))
    return response.redirect().back()
  }

  async update({ auth, params, request, response, session, i18n }: HttpContext) {
    const { name } = await request.validateUsing(renamePasskeyValidator)
    await this.service.rename(auth.getUserOrFail(), Number(params.id), name)

    session.flash('success', i18n.t('account.passkeys.renamed'))
    return response.redirect().back()
  }

  async destroy({ auth, params, response, session, i18n }: HttpContext) {
    await this.service.remove(auth.getUserOrFail(), Number(params.id))

    session.flash('success', i18n.t('account.passkeys.removed'))
    return response.redirect().back()
  }
}
