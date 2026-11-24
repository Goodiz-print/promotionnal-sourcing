import { test } from '@japa/runner'
import { subscriptionUpsell } from '#shared/helpers/subscription'

test.group('subscriptionUpsell', () => {
  test('aucun encart pour un abonné, sans évaluer le droit de souscrire', async ({ assert }) => {
    let evaluated = false
    const upsell = await subscriptionUpsell(true, async () => {
      evaluated = true
      return true
    })

    assert.isNull(upsell)
    assert.isFalse(evaluated)
  })

  test('un non abonné reçoit l’encart avec son droit de souscrire', async ({ assert }) => {
    assert.deepEqual(await subscriptionUpsell(false, async () => true), { canSubscribe: true })
    assert.deepEqual(await subscriptionUpsell(false, async () => false), { canSubscribe: false })
  })
})
