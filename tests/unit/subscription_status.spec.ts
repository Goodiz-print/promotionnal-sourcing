import { test } from '@japa/runner'
import { statusFromProvider } from '#shared/helpers/subscription'

test.group('Abonnements — statut Stripe', () => {
  test('le statut Stripe {self} devient {status}')
    .with([
      { self: 'active', status: 'active' },
      { self: 'trialing', status: 'active' },
      { self: 'past_due', status: 'past_due' },
      { self: 'incomplete', status: 'pending' },
      { self: 'unpaid', status: 'cancelled' },
      { self: 'canceled', status: 'cancelled' },
      { self: 'incomplete_expired', status: 'cancelled' },
      { self: 'paused', status: 'cancelled' },
      { self: 'something_new', status: 'cancelled' },
    ])
    .run(({ assert }, row) => {
      assert.equal(statusFromProvider(row.self), row.status)
    })
})
