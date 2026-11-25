import { test } from '@japa/runner'
import { formatDateTime, formatShortDate } from '#shared/helpers/date'

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

  test('donne le jour à Paris, pas celui du fuseau d’exécution', ({ assert }) => {
    assert.equal(formatShortDate('2026-11-24T23:30:00Z', 'fr'), '25/11/2026')
  })
})

test.group('formatDateTime', () => {
  test('affiche l’heure de Paris en hiver (UTC+1)', ({ assert }) => {
    assert.equal(formatDateTime('2026-11-25T01:51:00Z', 'fr'), '25 nov. 2026, 02:51')
  })

  test('affiche l’heure de Paris en été (UTC+2)', ({ assert }) => {
    assert.equal(formatDateTime('2026-07-01T10:00:00Z', 'fr'), '1 juil. 2026, 12:00')
  })

  test('suit la langue demandée', ({ assert }) => {
    assert.equal(formatDateTime('2026-11-25T01:51:00Z', 'en'), 'Nov 25, 2026, 2:51 AM')
  })

  test('change de jour selon Paris autour de minuit UTC', ({ assert }) => {
    assert.equal(formatDateTime('2026-11-24T23:30:00Z', 'fr'), '25 nov. 2026, 00:30')
  })
})
