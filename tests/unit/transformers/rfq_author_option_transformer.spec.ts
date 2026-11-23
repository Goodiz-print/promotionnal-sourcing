import { test } from '@japa/runner'
import { UserFactory } from '#database/factories/user_factory'
import RfqAuthorOptionTransformer from '#transformers/rfq_author_option_transformer'

test.group('RfqAuthorOptionTransformer (#228)', () => {
  test('expose l’identifiant et le nom, rien d’autre du compte', async ({ assert }) => {
    const user = await UserFactory.merge({
      id: 4,
      firstName: 'Camille',
      lastName: 'Martin',
      email: 'camille@agence.test',
      password: 'secret-hash',
    }).make()

    assert.deepEqual(new RfqAuthorOptionTransformer(user).toObject(), {
      id: 4,
      name: 'Camille Martin',
    })
  })

  test('sans nom renseigné, l’adresse tient lieu de nom', async ({ assert }) => {
    const user = await UserFactory.merge({
      id: 5,
      firstName: null,
      lastName: null,
      email: 'contact@agence.test',
    }).make()

    assert.deepEqual(new RfqAuthorOptionTransformer(user).toObject(), {
      id: 5,
      name: 'contact@agence.test',
    })
  })
})
