import { inject } from '@adonisjs/core'
import type Organization from '#models/organization'
import type User from '#models/user'
import OrganizationService from '#services/organization_service'
import type { OnboardingData } from '#shared/types/organization'

/**
 * Onboarding : crée la première organisation de l'utilisateur, l'y rattache
 * en `owner` et en fait son organisation courante. La création elle-même vit
 * dans `OrganizationService#create`, partagée avec la création d'une
 * organisation supplémentaire — l'onboarding n'en est que le premier appel.
 */
@inject()
export default class OnboardingService {
  constructor(private organizations: OrganizationService) {}

  completeOnboarding(user: User, data: OnboardingData): Promise<Organization> {
    return this.organizations.create(user, data)
  }
}
