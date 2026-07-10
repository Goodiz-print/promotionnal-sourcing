import { DateTime } from 'luxon'
import stringHelpers from '@adonisjs/core/helpers/string'
import Organization from '#models/organization'
import OrganizationUser from '#models/organization_user'
import Role from '#models/role'
import type User from '#models/user'
import type { OnboardingData } from '#shared/types/organization'

/**
 * Onboarding : crée la première organisation de l'utilisateur, l'y rattache
 * en `owner` et en fait son organisation courante. Toute la logique ORM vit
 * ici (controllers fins). Miroir de `dev_user_seeder`.
 */
export default class OnboardingService {
  async completeOnboarding(user: User, data: OnboardingData): Promise<Organization> {
    const slug = await this.uniqueSlug(data.name)

    const organization = await Organization.create({
      name: data.name,
      slug,
      country: 'FR',
      organizationType: data.organizationType,
    })

    const ownerRole = await Role.findByOrFail('slug', 'owner')
    await OrganizationUser.create({
      userId: user.id,
      organizationId: organization.id,
      roleId: ownerRole.id,
      joinedAt: DateTime.now(),
    })

    await user.merge({ currentOrganizationId: organization.id }).save()

    return organization
  }

  /**
   * Slug dérivé du nom, rendu unique par suffixe numérique en cas de collision.
   */
  private async uniqueSlug(name: string): Promise<string> {
    const base = stringHelpers.slug(name, { lower: true }) || 'organisation'
    let slug = base
    let suffix = 2

    while (await Organization.findBy('slug', slug)) {
      slug = `${base}-${suffix}`
      suffix += 1
    }

    return slug
  }
}
