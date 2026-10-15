import { randomBytes } from 'node:crypto'
import factory from '@adonisjs/lucid/factories'
import Passkey from '#models/passkey'

/**
 * Passkey à clé publique factice : suffit pour tout ce qui ne vérifie pas de
 * signature (liste, renommage, suppression). Pour une vraie connexion, fournir
 * `credentialId` et `publicKey` d'un `FakeAuthenticator` (`tests/utils/`).
 * `userId` reste à fournir par l'appelant.
 */
export const PasskeyFactory = factory
  .define(Passkey, ({ faker }) => ({
    credentialId: randomBytes(32).toString('base64url'),
    publicKey: randomBytes(77).toString('base64url'),
    counter: 0,
    transports: ['internal'],
    deviceType: 'multiDevice',
    backedUp: true,
    name: faker.commerce.productName().slice(0, 100),
  }))
  .build()
