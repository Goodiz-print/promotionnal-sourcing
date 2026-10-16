import app from '@adonisjs/core/services/app'
import { errors as limiterErrors } from '@adonisjs/limiter'
import { type HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import type { StatusPageRange, StatusPageRenderer } from '@adonisjs/core/types/http'

export default class HttpExceptionHandler extends ExceptionHandler {
  /**
   * In debug mode, the exception handler will display verbose errors
   * with pretty printed stack traces.
   */
  protected debug = !app.inProduction

  /**
   * Status pages are used to display a custom HTML pages for certain error
   * codes. You might want to enable them in production only, but feel
   * free to enable them in development as well.
   */
  protected renderStatusPages = app.inProduction

  /**
   * Status pages is a collection of error code range and a callback
   * to return the HTML contents to send as a response.
   */
  protected statusPages: Record<StatusPageRange, StatusPageRenderer> = {
    '404': (_, { inertia }) => inertia.render('errors/not_found', {}),
    '500..599': (_, { inertia }) => inertia.render('errors/server_error', {}),
  }

  /**
   * The method is used for handling errors and returning
   * response to the client
   */
  async handle(error: unknown, ctx: HttpContext) {
    if (error instanceof limiterErrors.E_TOO_MANY_REQUESTS && this.expectsPage(ctx)) {
      return this.handleThrottled(error, ctx)
    }

    return super.handle(error, ctx)
  }

  /**
   * Écran Inertia ou navigation classique (par opposition à un client API qui
   * attend du JSON) : `X-Inertia` prime, un `Accept: application/json` sans lui
   * reste une requête API.
   */
  private expectsPage({ request }: HttpContext): boolean {
    return Boolean(request.header('x-inertia')) || request.accepts(['html', 'json']) !== 'json'
  }

  /**
   * Limite de débit dépassée sur un écran : retour sur le formulaire avec un
   * message flash (jamais une page d'erreur 429 ni du JSON), `Retry-After`
   * conservé pour les clients qui le lisent.
   */
  private handleThrottled(
    error: InstanceType<typeof limiterErrors.E_TOO_MANY_REQUESTS>,
    ctx: HttpContext
  ) {
    const minutes = Math.max(1, Math.ceil(error.response.availableIn / 60))

    ctx.session.flash('error', ctx.i18n.t('auth.throttled', { minutes }))
    ctx.response.header('Retry-After', String(error.response.availableIn))
    return ctx.response.redirect().back()
  }

  /**
   * The method is used to report error to the logging service or
   * the a third party error monitoring service.
   *
   * @note You should not attempt to send a response from this method.
   */
  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }
}
