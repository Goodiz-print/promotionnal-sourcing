import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { isLateReply } from '#shared/helpers/rfq_deadline'

/** Début du 31 octobre, heure de Paris : une échéance au 30 est passée ce jour-là. */
const receptionDayStart = DateTime.fromISO('2026-10-31T00:00:00', { zone: 'Europe/Paris' })
const deadline = (iso: string) => DateTime.fromISO(iso, { zone: 'Europe/Paris' })

test.group('isLateReply (#232)', () => {
  test('échéance passée au jour de réception : tardive, demande expirée ou non', ({ assert }) => {
    assert.isTrue(
      isLateReply({ status: 'expired', deadline: deadline('2026-10-30') }, receptionDayStart)
    )
    assert.isTrue(
      isLateReply({ status: 'published', deadline: deadline('2026-10-30') }, receptionDayStart)
    )
  })

  test('reçue le jour de l’échéance : dans les temps, même si la demande a expiré depuis', ({
    assert,
  }) => {
    assert.isFalse(
      isLateReply({ status: 'expired', deadline: deadline('2026-10-31') }, receptionDayStart)
    )
    assert.isFalse(
      isLateReply({ status: 'published', deadline: deadline('2026-10-31') }, receptionDayStart)
    )
  })

  test('sans échéance : tardive seulement si la demande a été expirée', ({ assert }) => {
    assert.isTrue(isLateReply({ status: 'expired', deadline: null }, receptionDayStart))
    assert.isFalse(isLateReply({ status: 'published', deadline: null }, receptionDayStart))
  })

  test('une demande close ou en brouillon n’attend rien : jamais tardive', ({ assert }) => {
    assert.isFalse(
      isLateReply({ status: 'closed', deadline: deadline('2026-10-01') }, receptionDayStart)
    )
    assert.isFalse(
      isLateReply({ status: 'draft', deadline: deadline('2026-10-01') }, receptionDayStart)
    )
  })
})
