import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import OrganizationInvitationsService from '#services/organization_invitations_service'
import type OrganizationInvitation from '#models/organization_invitation'

const SIGNATURE_PURPOSE = 'organization-invitation'

/**
 * Écran public d'acceptation d'une invitation (lien reçu par email, URL
 * signée). Aucune authentification requise pour `show` (aperçu) ; `accept`
 * exige d'être connecté (route hors groupe `onboarded`, cf. `start/routes.ts`
 * — un invité sans organisation ne doit pas être bloqué vers l'onboarding
 * avant d'avoir pu accepter).
 */
@inject()
export default class InvitationAcceptanceController {
  constructor(private service: OrganizationInvitationsService) {}

  /**
   * Aperçu de l'invitation : affiche organisation/rôle/invitant, et propose
   * "Se connecter"/"Créer un compte" (avec retour sur cette page après
   * authentification) si l'utilisateur n'est pas connecté, sinon "Accepter".
   */
  async show({ request, auth, inertia, i18n }: HttpContext) {
    if (!request.hasValidSignature(SIGNATURE_PURPOSE)) {
      return inertia.render('organization/invitation_invalid', {})
    }

    const invitation = await this.service.findById(Number(request.param('id')))
    if (!this.isAcceptable(invitation)) {
      return inertia.render('organization/invitation_invalid', {})
    }

    const returnUrl = request.url(true)

    return inertia.render('organization/invitation_accept', {
      invitation: {
        id: invitation.id,
        organizationName: invitation.organization.name,
        roleName: invitation.role.name,
        invitedByName: invitation.invitedBy?.fullName ?? invitation.invitedBy?.email ?? null,
        email: invitation.email,
      },
      currentUserEmail: auth.user?.email ?? null,
      // Même chemin que `show` (GET/POST sur `/organization/invitations/:id/accept`) :
      // le POST doit porter la même querystring signée, jamais reconstruite via
      // `urlFor` côté client (qui perdrait la signature).
      acceptActionUrl: returnUrl,
      loginUrl: `/${i18n.locale}/login?redirect=${encodeURIComponent(returnUrl)}`,
      signupUrl: `/${i18n.locale}/signup?redirect=${encodeURIComponent(returnUrl)}&email=${encodeURIComponent(invitation.email)}`,
    })
  }

  /**
   * Accepte l'invitation pour l'utilisateur connecté. Rejette si l'email du
   * compte connecté ne correspond pas à l'email invité (empêche un autre
   * utilisateur authentifié d'accepter une invitation qui ne lui est pas
   * destinée). Les redirections d'échec réutilisent l'URL entrante (même
   * querystring signée) pour retomber sur `show`, qui revalide la signature.
   */
  async accept({ request, auth, response, i18n, session }: HttpContext) {
    const user = auth.getUserOrFail()

    // `request.url(true)` porte déjà la querystring signée à elle seule ;
    // `forwardQueryString: false` évite de la dupliquer sur l'URL cible.
    if (!request.hasValidSignature(SIGNATURE_PURPOSE)) {
      session.flash('error', i18n.t('organization.invitations.accept.invalid'))
      return response.redirect().withQs(false).toPath(request.url(true))
    }

    const invitation = await this.service.findById(Number(request.param('id')))
    if (!this.isAcceptable(invitation)) {
      session.flash('error', i18n.t('organization.invitations.accept.invalid'))
      return response.redirect().withQs(false).toPath(request.url(true))
    }

    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      session.flash('error', i18n.t('organization.invitations.accept.emailMismatch'))
      return response.redirect().withQs(false).toPath(request.url(true))
    }

    await this.service.accept(invitation, user)
    session.flash('success', i18n.t('organization.invitations.accept.success'))
    // `withQs(false)` : ne pas laisser fuiter la querystring signée sur la
    // page d'accueil (cf. config/app.ts `forwardQueryString: true`).
    return response.redirect().withQs(false).toRoute('home', { locale: i18n.locale })
  }

  private isAcceptable(invitation: OrganizationInvitation): boolean {
    return invitation.status === 'pending' && invitation.expiresAt > DateTime.now()
  }
}
