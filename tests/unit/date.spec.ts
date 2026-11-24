import { test } from '@japa/runner'
import { formatShortDate } from '#shared/helpers/date'

test.group('formatShortDate', () => {
  test('formate une date ISO au format court de la langue', ({ assert }) => {
    assert.equal(formatShortDate('2026-11-24T10:00:00Z', 'fr'), '24/11/2026')
    assert.equal(formatShortDate('2026-11-24T10:00:00Z', 'en'), '11/24/2026')
    assert.equal(formatShortDate('2026-11-24T10:00:00Z', 'de'), '24.11.2026')
  })

  test('suit la langue demandée, pas celle du serveur', ({ assert }) => {
    assert.notEqual(
      formatShortDate('2026-11-24T10:00:00Z', 'fr'),
      formatShortDate('2026-11-24T10:00:00Z', 'en')
    )
  })
})
