import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import i18nManager from '@adonisjs/i18n/services/main'
import UserTransformer from '#transformers/user_transformer'
import OrganizationSummaryTransformer from '#transformers/organization_summary_transformer'
import OrganizationContextService from '#services/organization_context_service'
import NavigationService from '#services/navigation_service'
import NotificationService from '#services/notification_service'
import NotificationTransformer from '#transformers/notification_transformer'
import BaseInertiaMiddleware from '@adonisjs/inertia/inertia_middleware'
import type { RoleSlug } from '#shared/types/role'
import { DEFAULT_LOCALE, ENGLISH_FALLBACK_NAMESPACES, type Locale } from '#shared/types/i18n'
import { NOTIFICATION_DROPDOWN_SIZE } from '#shared/types/notification'

@inject()
export default class InertiaMiddleware extends BaseInertiaMiddleware {
  constructor(
    private organizations: OrganizationContextService,
    private navigation: NavigationService,
    private notifications: NotificationService
  ) {
    super()
  }

  async share(ctx: HttpContext) {
    /**
     * The share method is called everytime an Inertia page is rendered. In
     * certain cases, a page may get rendered before the session middleware
     * or the auth middleware are executed. For example: During a 404 request.
     *
     * In that case, we must always assume that HttpContext is not fully hydrated
     * with all the properties
     */
    const { session, auth, i18n } = ctx as Partial<HttpContext>

    /**
     * Fetching the first error from the flash messages
     */
    const error = session?.flashMessages.get('error') as string
    const success = session?.flashMessages.get('success') as string

    /**
     * Locale active + dictionnaire de traductions exposés au frontend.
     * Le middleware "detect_user_locale" peut ne pas avoir tourné sur
     * certaines requêtes (ex: 404), d'où le repli sur la locale par défaut.
     */
    const locale = i18n?.locale ?? DEFAULT_LOCALE

    /**
     * Sélecteur d'organisation : organisations vivantes de l'utilisateur et
     * identifiant de la courante. Une seule requête, jamais pour un visiteur
     * anonyme ; le sélecteur ne s'affiche qu'au-delà d'une organisation.
     */
    const memberships = auth?.user ? await this.organizations.membershipsFor(auth.user) : []
    const organizations = memberships.map((membership) =>
      new OrganizationSummaryTransformer(membership).toObject()
    )

    /**
     * Menu applicatif : calculé depuis l'adhésion à l'organisation courante
     * (type + rôle). Une organisation courante archivée ou quittée n'apparaît
     * pas dans `memberships` → menu public.
     */
    const current = memberships.find(
      (membership) => membership.organizationId === auth?.user?.currentOrganizationId
    )
    const navigation = this.navigation.itemsFor(
      current
        ? {
            organizationType: current.organization.organizationType,
            roleSlug: current.role.slug as RoleSlug,
          }
        : null,
      auth?.user?.isPlatformAdmin ?? false
    )

    /**
     * Data shared with all Inertia pages. Make sure you are using
     * transformers for rich data-types like Models.
     */
    return {
      errors: ctx.inertia.always(this.getValidationErrors(ctx)),
      flash: ctx.inertia.always({
        error,
        success,
      }),
      user: ctx.inertia.always(auth?.user ? UserTransformer.transform(auth.user) : undefined),
      locale: ctx.inertia.always(locale),
      supportedLocales: ctx.inertia.always(i18nManager.supportedLocales()),
      translations: ctx.inertia.always(this.translationsFor(locale as Locale)),
      organizations: ctx.inertia.always(organizations),
      navigation: ctx.inertia.always(navigation),
      // `undefined` et non `null` : le sérialiseur de props refuse une valeur
      // nulle (`Cannot serialize an item with null value`), y compris sur les
      // pages publiques rendues sans utilisateur connecté. Même convention que
      // le prop `user` ci-dessus.
      currentOrganizationId: ctx.inertia.always(auth?.user?.currentOrganizationId ?? undefined),
      // Cloche (#57) : le compteur accompagne chaque page ; la liste, plus coûteuse,
      // n'est calculée que quand le menu s'ouvre (partial reload). `undefined`
      // hors connexion, pour la même raison que `user`.
      unreadNotificationsCount: ctx.inertia.always(
        auth?.user ? await this.notifications.unreadCount(auth.user) : undefined
      ),
      recentNotifications: ctx.inertia.optional(async () => {
        if (!auth?.user) return []
        const recent = await this.notifications.listFor(auth.user, {
          limit: NOTIFICATION_DROPDOWN_SIZE,
        })
        return recent.map((notification) =>
          new NotificationTransformer(notification, locale as Locale).toObject()
        )
      }),
    }
  }

  /**
   * Dictionnaire de la locale, complété par l'anglais pour les domaines que la
   * langue n'a pas (cf. `ENGLISH_FALLBACK_NAMESPACES`).
   */
  private translationsFor(locale: Locale): Record<string, string> {
    const own = this.withoutServerOnly(i18nManager.getTranslationsFor(locale))
    if (locale === 'en') {
      return own
    }

    const missing = ENGLISH_FALLBACK_NAMESPACES.filter(
      (namespace) => !Object.keys(own).some((key) => key.startsWith(`${namespace}.`))
    )
    if (missing.length === 0) {
      return own
    }

    const english = this.withoutServerOnly(i18nManager.getTranslationsFor('en'))
    const fallback = Object.fromEntries(
      Object.entries(english).filter(([key]) =>
        missing.some((namespace) => key.startsWith(`${namespace}.`))
      )
    )
    return { ...fallback, ...own }
  }

  /**
   * Les textes des mails (`emails.*`) ne servent qu'au worker : inutile de les
   * embarquer dans chaque page.
   */
  private withoutServerOnly(translations: Record<string, string>): Record<string, string> {
    return Object.fromEntries(
      Object.entries(translations).filter(([key]) => !key.startsWith('emails.'))
    )
  }

  async handle(ctx: HttpContext, next: NextFn) {
    await this.init(ctx)

    const output = await next()
    this.dispose(ctx)

    return output
  }
}

declare module '@adonisjs/inertia/types' {
  type MiddlewareSharedProps = InferSharedProps<InertiaMiddleware>
  export interface SharedProps extends MiddlewareSharedProps {}
}
