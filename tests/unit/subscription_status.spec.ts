import { test } from '@japa/runner'
import { isSubscriptionEventType, statusFromProvider } from '#shared/helpers/subscription'
import NullSubscriptionBillingGateway from '#services/subscriptions/null_subscription_billing_gateway'

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

test.group('Abonnements — types de notification', () => {
  test('{self} concerne un abonnement : {expected}')
    .with([
      { self: 'customer.subscription.created', expected: true },
      { self: 'customer.subscription.deleted', expected: true },
      { self: 'invoice.paid', expected: true },
      { self: 'invoice.payment_failed', expected: true },
      { self: 'checkout.session.completed', expected: false },
      { self: 'customer.created', expected: false },
    ])
    .run(({ assert }, row) => {
      assert.equal(isSubscriptionEventType(row.self), row.expected)
    })

  test('sans configuration, toute notification est ignorée sans lever', async ({ assert }) => {
    const gateway = new NullSubscriptionBillingGateway()

    assert.isNull(await gateway.parseWebhook('{"type":"invoice.paid"}'))
    assert.isNull(await gateway.parseWebhook('{"type":"checkout.session.completed"}'))
    assert.isNull(await gateway.parseWebhook('not json'))
    assert.isNull(await gateway.parseWebhook('null'))
  })
})
