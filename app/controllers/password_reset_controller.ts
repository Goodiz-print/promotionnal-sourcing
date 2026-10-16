import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import PasswordResetService from '#services/password_reset_service'
import { forgotPasswordValidator, resetPasswordValidator } from '#validators/password'
import { PASSWORD_RESET_SIGNATURE_PURPOSE } from '#shared/types/auth'

/**
 * « Mot de passe oublié » : demande par email puis choix d'un nouveau mot de
 * passe via un lien signé (cf. `PasswordResetService`).
 */
@inject()
export default class PasswordResetController {
  constructor(private service: PasswordResetService) {}

  async create({ inertia }: HttpContext) {
    return inertia.render('auth/forgot_password', {})
  }

  /**
   * Réponse identique que le compte existe ou non : aucune énumération
   * d'adresses.
   */
  async store({ request, response, session, i18n }: HttpContext) {
    const { email } = await request.validateUsing(forgotPasswordValidator)
    await this.service.request(email, i18n.locale)

    session.flash('success', i18n.t('auth.forgot.sent'))
    return response.redirect().back()
  }

  async edit(ctx: HttpContext) {
    const user = await this.resolveUser(ctx)
    if (!user) return this.invalidLink(ctx)

    return ctx.inertia.render('auth/reset_password', {
      // Le POST doit porter la même querystring signée, jamais reconstruite
      // côté client (elle perdrait la signature).
      actionUrl: ctx.request.url(true),
    })
  }

  async update(ctx: HttpContext) {
    const user = await this.resolveUser(ctx)
    if (!user) return this.invalidLink(ctx)

    const { password } = await ctx.request.validateUsing(resetPasswordValidator)
    await this.service.reset(user, password)

    ctx.session.flash('success', ctx.i18n.t('auth.reset.done'))
    return ctx.response.redirect().withQs(false).toRoute('session.create', {
      locale: ctx.i18n.locale,
    })
  }

  private async resolveUser({ request }: HttpContext) {
    if (!request.hasValidSignature(PASSWORD_RESET_SIGNATURE_PURPOSE)) return null
    return this.service.resolve(Number(request.param('id')), request.qs().v)
  }

  private invalidLink({ session, response, i18n }: HttpContext) {
    session.flash('error', i18n.t('auth.reset.invalidLink'))
    return response.redirect().withQs(false).toRoute('password.forgot', { locale: i18n.locale })
  }
}
