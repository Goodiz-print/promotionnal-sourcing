import factory from '@adonisjs/lucid/factories'
import SupplierContact from '#models/supplier_contact'

/**
 * Contact commercial fournisseur. `organizationId` est à fournir par l'appelant.
 */
export const SupplierContactFactory = factory
  .define(SupplierContact, ({ faker }) => ({
    name: faker.person.fullName(),
    jobTitle: faker.person.jobTitle(),
    email: faker.internet.email(),
    languages: ['fr', 'en'],
  }))
  .build()
