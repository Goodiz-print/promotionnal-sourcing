import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { isLateReply } from '#shared/helpers/rfq_deadline'

/** Début du 31 octobre, heure de Paris : une échéance au 30 est passée. */
const startOfToday = DateTime.fromISO('2026-10-31T00:00:00', { zone: 'Europe/Paris' })
const deadline = (iso: string) => DateTime.fromISO(iso, { zone: 'Europe/Paris' })

test.group('isLateReply (#232)', () => {
  test('une demande expirée : toute réponse est tardive', ({ assert }) => {
    assert.isTrue(
      isLateReply({ status: 'expired', deadline: deadline('2026-10-30') }, startOfToday)
    )
    assert.isTrue(isLateReply({ status: 'expired', deadline: null }, startOfToday))
  })

  test('une demande publiée dont l’échéance est passée, avant le passage du job', ({ assert }) => {
    assert.isTrue(
      isLateReply({ status: 'published', deadline: deadline('2026-10-30') }, startOfToday)
    )
  })

  test('l’échéance du jour, ou aucune échéance : la réponse est dans les temps', ({ assert }) => {
    assert.isFalse(
      isLateReply({ status: 'published', deadline: deadline('2026-10-31') }, startOfToday)
    )
    assert.isFalse(isLateReply({ status: 'published', deadline: null }, startOfToday))
  })

  test('une demande close ou en brouillon n’attend rien : jamais tardive', ({ assert }) => {
    assert.isFalse(
      isLateReply({ status: 'closed', deadline: deadline('2026-10-01') }, startOfToday)
    )
    assert.isFalse(isLateReply({ status: 'draft', deadline: deadline('2026-10-01') }, startOfToday))
  })
})
