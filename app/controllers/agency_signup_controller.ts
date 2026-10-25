import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import EmailVerificationService from '#services/email_verification_service'
import AgencySignupService from '#services/agency_signup_service'
import { agencySignupValidator } from '#validators/agency_signup'
import { isSafeRedirectPath } from '#shared/helpers/safe_redirect'
import type { AgencySignupData } from '#shared/types/agency_signup'

@inject()
export default class AgencySignupController {
  constructor(
    private signup: AgencySignupService,
    private emailVerification: EmailVerificationService
  ) {}

  /** Formulaire d'inscription agence (public). */
  async create({ request, inertia }: HttpContext) {
    const { redirect } = request.qs()
    return inertia.render('auth/signup_agency', {
      redirect: isSafeRedirectPath(redirect) ? redirect : null,
    })
  }

  async store({ request, response, auth, i18n, session }: HttpContext) {
    const payload = await request.validateUsing(agencySignupValidator)
    const data: AgencySignupData = {
      ...payload,
      civility: payload.civility ?? null,
      website: payload.website ?? null,
      phone: payload.phone ?? null,
      activityOther: payload.activityOther ?? null,
      acceptsPartnerCommunications: payload.acceptsPartnerCommunications ?? false,
    }

    const { user, reviewReasons } = await this.signup.register(data, {
      ipAddress: request.ip(),
      pageLocale: i18n.locale,
    })

    await auth.use('web').login(user)
    // Comme à l'inscription simple : un échec de mise en queue ne défait pas le compte.
    try {
      await this.emailVerification.send(user, i18n.locale)
    } catch (error) {
      logger.warn({ err: error, userId: user.id }, 'email verification mail could not be queued')
    }

    session.flash(
      'success',
      i18n.t(reviewReasons.length === 0 ? 'agency_signup.active' : 'agency_signup.pending_review')
    )
    return response.redirect().withQs(false).toRoute('email.notice', { locale: i18n.locale })
  }
}
