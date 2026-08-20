import factory from '@adonisjs/lucid/factories'
import User from '#models/user'

/**
 * Mot de passe commun à tous les utilisateurs de test : le passer **en clair**
 * est volontaire — `User` compose `withAuthFinder`, dont le hook `beforeSave`
 * hache le champ. Appeler `hash.make()` en amont (ce que faisaient les specs)
 * produisait un hash de hash : inoffensif tant qu'on se connecte via
 * `loginAs`, mais un `POST /login` avec ce mot de passe échouait.
 */
export const TEST_PASSWORD = 'password123'

export const UserFactory = factory
  .define(User, ({ faker }) => ({
    email: faker.internet.email().toLowerCase(),
    fullName: faker.person.fullName(),
    password: TEST_PASSWORD,
  }))
  .build()
