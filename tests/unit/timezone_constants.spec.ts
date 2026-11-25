import { test } from '@japa/runner'
import { PLATFORM_TIMEZONE } from '#shared/types/date'
import { RFQ_DEADLINE_TIMEZONE } from '#shared/types/rfq'
import { SUBSCRIPTION_TIMEZONE } from '#shared/types/subscription'

test.group('Fuseau de la plateforme', () => {
  test('échéances et abonnements suivent le fuseau d’affichage', ({ assert }) => {
    assert.equal(PLATFORM_TIMEZONE, 'Europe/Paris')
    assert.equal(RFQ_DEADLINE_TIMEZONE, PLATFORM_TIMEZONE)
    assert.equal(SUBSCRIPTION_TIMEZONE, PLATFORM_TIMEZONE)
  })
})
