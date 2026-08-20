import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { onboardingValidator } from '#validators/onboarding'
import OrganizationService from '#services/organization_service'
import OrganizationContextService from '#services/organization_context_service'
import {
  LastOwnerException,
  NotAMemberException,
  OrganizationArchivedException,
} from '#exceptions/organization_errors'

/**
 * Cycle de vie de l'organisation côté utilisateur : basculer d'une organisation
 * à l'autre (sélecteur, visible seulement au-delà d'une organisation) et créer
 * une organisation supplémentaire.
 */
@inject()
export default class OrganizationLifecycleController {
  constructor(
    private service: OrganizationService,
    private context: OrganizationContextService
  ) {}

  /**
   * Bascule sur une autre organisation de l'utilisateur. Une organisation
   * étrangère ou archivée donne un flash d'erreur plutôt qu'une page d'erreur :
   * le sélecteur peut afficher un état obsolète (organisation archivée entre
   * deux requêtes), ce n'est pas une faute de l'utilisateur.
   */
  async switch({ auth, params, response, i18n, session }: HttpContext) {
    try {
      const organization = await this.context.switchTo(auth.getUserOrFail(), Number(params.id))
      session.flash('success', i18n.t('organization.switch.done', { name: organization.name }))
    } catch (error) {
      if (error instanceof NotAMemberException || error instanceof OrganizationArchivedException) {
        session.flash('error', i18n.t('organization.switch.unavailable'))
      } else {
        throw error
      }
    }

    return response.redirect().back()
  }

  /**
   * Écran de création d'une organisation supplémentaire (mêmes champs que
   * l'onboarding).
   */
  async create({ inertia }: HttpContext) {
    return inertia.render('organization/create', {})
  }

  /**
   * Crée l'organisation et bascule dessus — c'est l'intention de qui la crée.
   * Même payload que l'onboarding (nom + type), d'où le validator partagé : le
   * slug est dérivé du nom côté service.
   */
  async store({ auth, request, response, i18n, session }: HttpContext) {
    const payload = await request.validateUsing(onboardingValidator)
    const organization = await this.service.create(auth.getUserOrFail(), payload)

    session.flash('success', i18n.t('organization.create.success', { name: organization.name }))
    return response.redirect().toRoute('organization.settings', { locale: i18n.locale })
  }

  /**
   * Départ volontaire de l'organisation courante. Le dernier owner est refusé
   * (flash) : il doit d'abord promouvoir quelqu'un ou archiver l'organisation.
   */
  async leave({ auth, response, i18n, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const organization = await this.context.currentFor(user)

    try {
      await this.service.leave(user, organization)
      session.flash('success', i18n.t('organization.leave.done', { name: organization.name }))
    } catch (error) {
      if (error instanceof LastOwnerException) {
        session.flash('error', i18n.t('organization.leave.lastOwner'))
      } else if (error instanceof NotAMemberException) {
        session.flash('error', i18n.t('organization.leave.notMember'))
      } else {
        throw error
      }
      return response.redirect().back()
    }

    return response.redirect().toRoute('home', { locale: i18n.locale })
  }

  /**
   * Archive l'organisation courante (owner/admin). Les autres membres basculent
   * ou repartent sur l'onboarding à leur requête suivante, via
   * `OnboardedMiddleware` ; on applique tout de suite la même règle à l'auteur
   * de l'archivage pour qu'il ne reste pas rattaché à une organisation morte.
   */
  async archive({ auth, bouncer, response, i18n, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const organization = await this.context.currentFor(user)
    await bouncer.authorize('canManageOrganization', organization)

    try {
      await this.service.archive(organization)
    } catch (error) {
      if (error instanceof OrganizationArchivedException) {
        session.flash('error', i18n.t('organization.archive.alreadyArchived'))
        return response.redirect().back()
      }
      throw error
    }

    await this.context.ensureUsableOrganization(user)
    session.flash('success', i18n.t('organization.archive.done', { name: organization.name }))

    return response.redirect().toRoute('home', { locale: i18n.locale })
  }
}
