import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import {
  acceptsResponses,
  isLateReply,
  parseRfqDeadline,
  startOfDeadlineDay,
} from '#shared/helpers/rfq_deadline'

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

test.group('startOfDeadlineDay', () => {
  test('minuit à Paris du jour de l’instant, quel que soit son fuseau', ({ assert }) => {
    // 23:30 UTC le 30 = 00:30 à Paris le 31.
    const start = startOfDeadlineDay(DateTime.fromISO('2026-10-30T23:30:00Z'))

    assert.equal(start.toISO(), '2026-10-31T00:00:00.000+01:00')
  })
})

test.group('parseRfqDeadline', () => {
  test('une date saisie est lue à minuit, heure de Paris', ({ assert }) => {
    assert.equal(parseRfqDeadline('2026-11-20')!.toISO(), '2026-11-20T00:00:00.000+01:00')
  })

  test('absente ou invalide : null', ({ assert }) => {
    assert.isNull(parseRfqDeadline(null))
    assert.isNull(parseRfqDeadline(undefined))
    assert.isNull(parseRfqDeadline(''))
    assert.isNull(parseRfqDeadline('pas une date'))
  })
})

test.group('acceptsResponses', () => {
  const now = DateTime.fromISO('2026-10-31T10:00:00', { zone: 'Europe/Paris' })

  test('publiée, sans échéance ou échéance aujourd’hui ou plus tard', ({ assert }) => {
    assert.isTrue(acceptsResponses({ status: 'published', deadline: null }, now))
    assert.isTrue(acceptsResponses({ status: 'published', deadline: deadline('2026-10-31') }, now))
  })

  test('publiée mais échéance passée, avant le passage du job', ({ assert }) => {
    assert.isFalse(acceptsResponses({ status: 'published', deadline: deadline('2026-10-30') }, now))
  })

  test('brouillon, close ou expirée : jamais', ({ assert }) => {
    ;(['draft', 'closed', 'expired'] as const).forEach((status) => {
      assert.isFalse(acceptsResponses({ status, deadline: null }, now))
    })
  })
})
