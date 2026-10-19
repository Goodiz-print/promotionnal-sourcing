import { test } from '@japa/runner'
import { ModerationDecisionFactory } from '#database/factories/moderation_decision_factory'
import { UserFactory } from '#database/factories/user_factory'
import ModerationService from '#services/moderation_service'
import { InvalidModerationInputException } from '#exceptions/moderation_errors'
import { useDatabase } from '#tests/utils/setup'

test.group('Modération', (group) => {
  useDatabase(group)

  test('une cible sans décision est pending', async ({ assert }) => {
    const service = new ModerationService()

    assert.equal(await service.currentStatus('product', 42), 'pending')
  })

  test('la dernière décision fait foi, et l’historique est conservé', async ({ assert }) => {
    const reviewer = await UserFactory.apply('platformAdmin').create()
    const service = new ModerationService()

    await service.decide({
      targetType: 'product',
      targetId: 7,
      status: 'rejected',
      decidedBy: reviewer,
      reason: 'Photos manquantes',
    })
    await service.decide({
      targetType: 'product',
      targetId: 7,
      status: 'approved',
      decidedBy: reviewer,
    })

    assert.equal(await service.currentStatus('product', 7), 'approved')
    const history = await service.history('product', 7)
    assert.lengthOf(history, 2)
    assert.equal(history[0].status, 'approved')
    assert.equal(history[1].reason, 'Photos manquantes')
  })

  test('les décisions d’une cible n’affectent pas une autre cible du même type', async ({
    assert,
  }) => {
    const reviewer = await UserFactory.create()
    const service = new ModerationService()
    await ModerationDecisionFactory.merge({ targetId: 1, status: 'rejected' }).create()

    assert.equal(await service.currentStatus('product', 1), 'rejected')
    assert.equal(await service.currentStatus('product', 2), 'pending')
    assert.equal(await service.currentStatus('organization', 1), 'pending')
    assert.isNotNull(reviewer.id)
  })

  test('une cible ou une décision hors liste est refusée', async ({ assert }) => {
    const reviewer = await UserFactory.create()
    const service = new ModerationService()

    await assert.rejects(
      () =>
        service.decide({
          targetType: 'rfq' as never,
          targetId: 1,
          status: 'approved',
          decidedBy: reviewer,
        }),
      InvalidModerationInputException
    )
    await assert.rejects(
      () =>
        service.decide({
          targetType: 'product',
          targetId: 1,
          status: 'pending' as never,
          decidedBy: reviewer,
        }),
      InvalidModerationInputException
    )
  })

  test('la fabrique produit une décision d’approbation par défaut', async ({ assert }) => {
    const decision = await ModerationDecisionFactory.create()

    assert.equal(decision.status, 'approved')
    assert.equal(decision.targetType, 'product')
  })
})
