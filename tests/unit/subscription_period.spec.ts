import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { partition } from '#shared/helpers/collections'
import { dayInSubscriptionZone, lastCoveredDay } from '#shared/helpers/subscription'
import {
  isValidSubscriptionPeriod,
  subscriptionDayEnd,
  subscriptionDayStart,
} from '#shared/helpers/subscription_period'

/** Utilitaires de période d'abonnement (#214) et de collections, sans base. */

test.group('Abonnements — période saisie en jours', () => {
  test('un jour commence à minuit heure de Paris', ({ assert }) => {
    // Hiver : UTC+1. Été : UTC+2.
    assert.equal(subscriptionDayStart('2026-12-01').toUTC().toISO(), '2026-11-30T23:00:00.000Z')
    assert.equal(subscriptionDayStart('2026-07-01').toUTC().toISO(), '2026-06-30T22:00:00.000Z')
  })

  test('la fin d’un dernier jour inclus est le début du jour suivant', ({ assert }) => {
    assert.equal(subscriptionDayEnd('2026-12-31').toUTC().toISO(), '2026-12-31T23:00:00.000Z')
    // Passage à l'heure d'été : la journée du 28 mars 2027 dure 23 heures.
    const start = subscriptionDayStart('2027-03-28')
    assert.equal(subscriptionDayEnd('2027-03-28').diff(start, 'hours').hours, 23)
  })

  test('un jour invalide donne une date invalide', ({ assert }) => {
    assert.isFalse(subscriptionDayStart('2026-02-30').isValid)
  })

  test('période valide : fin après le début et pas encore passée', ({ assert }) => {
    const now = DateTime.fromISO('2026-11-20T10:00:00Z')
    const start = subscriptionDayStart('2026-11-20')

    assert.isTrue(isValidSubscriptionPeriod(start, subscriptionDayEnd('2026-12-31'), now))
    assert.isTrue(isValidSubscriptionPeriod(start, subscriptionDayEnd('2026-11-20'), now))
    assert.isFalse(isValidSubscriptionPeriod(start, subscriptionDayEnd('2026-11-10'), now))
    assert.isFalse(
      isValidSubscriptionPeriod(
        subscriptionDayStart('2026-10-01'),
        subscriptionDayEnd('2026-11-19'),
        now
      )
    )
    assert.isFalse(isValidSubscriptionPeriod(start, subscriptionDayEnd('2026-02-30'), now))
  })

  test('les jours affichés côté front reprennent la même convention', ({ assert }) => {
    const end = subscriptionDayEnd('2026-12-31').toUTC().toISO()!
    assert.equal(lastCoveredDay(end), '2026-12-31')
    assert.equal(dayInSubscriptionZone(subscriptionDayStart('2026-12-01').toJSDate()), '2026-12-01')
  })
})

test.group('Collections — partition', () => {
  test('sépare gardés et écartés en conservant l’ordre', ({ assert }) => {
    assert.deepEqual(
      partition([1, 2, 3, 4, 5], (n) => n % 2 === 1),
      [
        [1, 3, 5],
        [2, 4],
      ]
    )
  })

  test('une liste vide donne deux listes vides', ({ assert }) => {
    assert.deepEqual(
      partition([], () => true),
      [[], []]
    )
  })
})
