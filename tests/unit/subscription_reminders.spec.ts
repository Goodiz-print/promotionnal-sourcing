import { test } from '@japa/runner'
import {
  dayInSubscriptionZone,
  dueReminderDays,
  isAnnualSubscription,
  lastCoveredDay,
} from '#shared/helpers/subscription'
import type { SubscriptionReminderState } from '#shared/types/subscription'

/** Règles de date des abonnements manuels (#214, #237), sans base. */

const DAY = 24 * 60 * 60 * 1000
const END = Date.parse('2027-01-01T00:00:00Z')

function state(
  durationDays: number,
  reminded: Partial<SubscriptionReminderState> = {}
): SubscriptionReminderState {
  return {
    startsAt: new Date(END - durationDays * DAY).toISOString(),
    endsAt: new Date(END).toISOString(),
    remindedEndsAt: null,
    remindedDays: null,
    ...reminded,
  }
}

const daysBefore = (days: number) => new Date(END - days * DAY)

test.group('Abonnements — jours à l’heure de Paris', () => {
  test('le dernier jour couvert précède la fin exclusive', ({ assert }) => {
    // 1er janvier 2027 à 00:00 à Paris = 31 décembre 23:00 UTC.
    assert.equal(lastCoveredDay('2026-12-31T23:00:00.000Z'), '2026-12-31')
    assert.equal(dayInSubscriptionZone(new Date('2026-11-30T23:30:00Z')), '2026-12-01')
  })

  test('un abonnement de 12 mois est annuel, un de 11 mois non', ({ assert }) => {
    assert.isTrue(isAnnualSubscription('2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z'))
    assert.isFalse(isAnnualSubscription('2026-02-01T00:00:00Z', '2027-01-01T00:00:00Z'))
  })
})

test.group('Abonnements — rappel dû (#237)', () => {
  test('mensuel : rien à 10 jours, rappel à 7 jours', ({ assert }) => {
    assert.isNull(dueReminderDays(state(31), daysBefore(10)))
    assert.equal(dueReminderDays(state(31), daysBefore(7)), 7)
    assert.equal(dueReminderDays(state(31), daysBefore(2)), 7)
  })

  test('annuel : 30 jours puis 7 jours', ({ assert }) => {
    assert.isNull(dueReminderDays(state(365), daysBefore(31)))
    assert.equal(dueReminderDays(state(365), daysBefore(30)), 30)
    assert.equal(dueReminderDays(state(365), daysBefore(6)), 7)
  })

  test('un rappel déjà parti pour cette date de fin ne repart pas', ({ assert }) => {
    const endsAt = new Date(END).toISOString()
    const after30 = state(365, { remindedEndsAt: endsAt, remindedDays: 30 })
    const after7 = state(365, { remindedEndsAt: endsAt, remindedDays: 7 })

    assert.isNull(dueReminderDays(after30, daysBefore(20)))
    assert.equal(dueReminderDays(after30, daysBefore(7)), 7)
    assert.isNull(dueReminderDays(after7, daysBefore(3)))
  })

  test('un rappel envoyé pour une ancienne date de fin ne compte pas', ({ assert }) => {
    const previousEnd = new Date(END - 30 * DAY).toISOString()
    const prolonged = state(60, { remindedEndsAt: previousEnd, remindedDays: 7 })

    assert.equal(dueReminderDays(prolonged, daysBefore(5)), 7)
  })

  test('aucun rappel après la fin, ni plus long que l’abonnement', ({ assert }) => {
    assert.isNull(dueReminderDays(state(31), new Date(END + DAY)))
    assert.isNull(dueReminderDays(state(5), daysBefore(3)))
  })
})
