import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import {
  dateRangeBounds,
  identifiableSince,
  nameTargets,
  toTargetTranslation,
  trailingDateRange,
} from '#shared/helpers/activity_event'
import { clampPage, toPaginationMeta } from '#shared/helpers/pagination'

const NOW = DateTime.fromISO('2026-11-24T15:30:00')

test.group('trailingDateRange', () => {
  test('couvre les N derniers jours, aujourd’hui compris', ({ assert }) => {
    assert.deepEqual(trailingDateRange(30, NOW), { from: '2026-10-26', to: '2026-11-24' })
    assert.deepEqual(trailingDateRange(1, NOW), { from: '2026-11-24', to: '2026-11-24' })
  })
})

test.group('dateRangeBounds', () => {
  test('début du premier jour inclus, lendemain du dernier jour exclu', ({ assert }) => {
    const { start, end } = dateRangeBounds({ from: '2026-11-01', to: '2026-11-24' })

    assert.equal(start, DateTime.fromISO('2026-11-01').startOf('day').toSQL())
    assert.equal(end, DateTime.fromISO('2026-11-25').startOf('day').toSQL())
  })
})

test.group('identifiableSince', () => {
  test('garde le début de période quand il est à moins de 90 jours', ({ assert }) => {
    const range = trailingDateRange(30, NOW)
    assert.equal(
      identifiableSince(range, NOW),
      DateTime.fromISO('2026-10-26').startOf('day').toSQL()
    )
  })

  test('ramène une période plus longue au seuil de pseudonymisation (90 jours)', ({ assert }) => {
    const range = trailingDateRange(365, NOW)
    assert.equal(identifiableSince(range, NOW), NOW.minus({ days: 90 }).toSQL())
  })
})

test.group('nameTargets', () => {
  const translations = [
    { targetId: 1, locale: 'fr', name: 'Stylo' },
    { targetId: 1, locale: 'en', name: 'Pen' },
    { targetId: 2, locale: 'de', name: 'Becher' },
  ]

  test('nomme chaque cible dans la langue demandée, avec repli', ({ assert }) => {
    const rows = [
      { targetId: 1, count: 3 },
      { targetId: 2, count: 1 },
    ]

    assert.deepEqual(nameTargets(rows, translations, 'en'), [
      { targetId: 1, count: 3, name: 'Pen' },
      { targetId: 2, count: 1, name: 'Becher' },
    ])
    assert.equal(nameTargets(rows, translations, 'fr')[0].name, 'Stylo')
  })

  test('conserve les autres champs et nomme `#id` une cible sans traduction', ({ assert }) => {
    assert.deepEqual(nameTargets([{ targetId: 9, views: 2 }], translations, 'fr'), [
      { targetId: 9, views: 2, name: '#9' },
    ])
  })

  test('aucune ligne, aucun nom', ({ assert }) => {
    assert.deepEqual(nameTargets([], translations, 'fr'), [])
  })
})

test.group('toTargetTranslation', () => {
  test('convertit une ligne brute (identifiant texte ou nombre)', ({ assert }) => {
    assert.deepEqual(toTargetTranslation({ target_id: '4', locale: 'fr', name: 'Gourde' }), {
      targetId: 4,
      locale: 'fr',
      name: 'Gourde',
    })
  })
})

test.group('toPaginationMeta', () => {
  test('réduit le paginator aux quatre champs du frontend', ({ assert }) => {
    assert.deepEqual(toPaginationMeta({ total: '120', perPage: 50, currentPage: 2, lastPage: 3 }), {
      total: 120,
      perPage: 50,
      currentPage: 2,
      lastPage: 3,
    })
  })

  test('une liste vide compte une page', ({ assert }) => {
    assert.equal(
      toPaginationMeta({ total: 0, perPage: 50, currentPage: 1, lastPage: 0 }).lastPage,
      1
    )
  })
})

test.group('clampPage', () => {
  test('garde une page existante', ({ assert }) => {
    assert.equal(clampPage(2, 3), 2)
  })

  test('ramène une page au-delà de la dernière à la dernière', ({ assert }) => {
    assert.equal(clampPage(9, 3), 3)
  })

  test('une liste vide reste en page 1', ({ assert }) => {
    assert.equal(clampPage(4, 0), 1)
  })
})
