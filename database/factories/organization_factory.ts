import { DateTime } from 'luxon'
import factory from '@adonisjs/lucid/factories'
import stringHelpers from '@adonisjs/core/helpers/string'
import Organization from '#models/organization'

export const OrganizationFactory = factory
  .define(Organization, ({ faker }) => {
    const name = faker.company.name()
    return {
      name,
      // Suffixe aléatoire : `organizations.slug` est unique et deux noms
      // d'entreprise générés peuvent se réduire au même slug.
      slug: stringHelpers.slug(`${name} ${faker.string.alphanumeric(6)}`, { lower: true }),
      country: 'FR',
    }
  })
  .state('supplier', (organization) => {
    organization.organizationType = 'supplier'
  })
  .state('both', (organization) => {
    organization.organizationType = 'both'
  })
  .state('archived', (organization) => {
    organization.archivedAt = DateTime.now()
  })
  .build()
