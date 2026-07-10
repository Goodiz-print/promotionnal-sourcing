import { I18n } from '@adonisjs/i18n'
import i18nManager from '@adonisjs/i18n/services/main'
import type { NextFn } from '@adonisjs/core/types/http'
import { type HttpContext, RequestValidator } from '@adonisjs/core/http'
import { isSupportedLocale, LOCALE_COOKIE } from '#shared/types/i18n'

/**
 * The "DetectUserLocaleMiddleware" middleware uses i18n service to share
 * a request specific i18n object with the HTTP Context
 */
export default class DetectUserLocaleMiddleware {
  /**
   * Using i18n for validation messages. Applicable to only
   * "request.validateUsing" method calls
   */
  static {
    RequestValidator.messagesProvider = (ctx) => {
      return ctx.i18n.createMessagesProvider()
    }
  }

  /**
   * Détermine la locale de la requête selon l'ordre de priorité :
   *   1. Préfixe d'URL "/:locale" (URL = source de vérité, SEO)
   *   2. Cookie "locale" (choix explicite du visiteur)
   *   3. Préférence enregistrée sur l'utilisateur authentifié
   *   4. En-tête "Accept-Language" (négociation de contenu)
   *   5. Locale par défaut (config i18n)
   */
  protected getRequestLocale(ctx: HttpContext) {
    const urlLocale = ctx.params?.locale
    if (isSupportedLocale(urlLocale)) {
      return urlLocale
    }

    const cookieLocale = ctx.request.cookie(LOCALE_COOKIE)
    if (isSupportedLocale(cookieLocale)) {
      return cookieLocale
    }

    const userLocale = ctx.auth?.user?.locale
    if (isSupportedLocale(userLocale)) {
      return userLocale
    }

    const headerLocale = i18nManager.getSupportedLocaleFor(ctx.request.languages())
    return headerLocale ?? i18nManager.defaultLocale
  }

  async handle(ctx: HttpContext, next: NextFn) {
    /**
     * Finding user language
     */
    const language = this.getRequestLocale(ctx)

    /**
     * Assigning i18n property to the HTTP context
     */
    ctx.i18n = i18nManager.locale(language || i18nManager.defaultLocale)

    /**
     * Quand la locale vient du préfixe d'URL, on la mémorise dans le
     * cookie : la racine "/" et les routes non préfixées se souviennent
     * ainsi de la dernière langue visitée.
     */
    if (isSupportedLocale(ctx.params?.locale)) {
      ctx.response.cookie(LOCALE_COOKIE, ctx.i18n.locale, { maxAge: '1y', sameSite: 'lax' })
    }

    /**
     * Binding I18n class to the request specific instance of it.
     * Doing so will allow IoC container to resolve an instance
     * of request specific i18n object when I18n class is
     * injected somewhere.
     */
    ctx.containerResolver.bindValue(I18n, ctx.i18n)

    /**
     * Sharing request specific instance of i18n with edge
     * templates.
     *
     * Remove the following block of code, if you are not using
     * edge templates.
     */
    if ('view' in ctx) {
      ctx.view.share({ i18n: ctx.i18n })
    }

    return next()
  }
}

/**
 * Notify TypeScript about i18n property
 */
declare module '@adonisjs/core/http' {
  export interface HttpContext {
    i18n: I18n
  }
}
