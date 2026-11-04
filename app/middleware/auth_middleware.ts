import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { Authenticators } from '@adonisjs/auth/types'

export default class AuthMiddleware {
  redirectTo = '/login'

  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: { guards?: (keyof Authenticators)[] } = {}
  ) {
    await ctx.auth.authenticateUsing(options.guards, { loginRoute: this.redirectTo })

    // Invalider la session d'un compte suspendu (#160).
    const user = ctx.auth.user
    if (user?.suspendedAt) {
      await ctx.auth.use('web').logout()
      ctx.session.flash('error', ctx.i18n.t('auth.suspended'))
      return ctx.response.redirect().toRoute('session.create', { locale: ctx.i18n.locale })
    }

    return next()
  }
}
