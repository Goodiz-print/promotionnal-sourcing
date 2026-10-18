import { DateTime } from 'luxon'
import factory from '@adonisjs/lucid/factories'
import ModerationDecisionRecord from '#models/moderation_decision'

/**
 * Décision d'approbation sur un produit. `targetId` et `decidedByUserId` sont à
 * fournir selon le cas ; la cible est polymorphe, donc aucune relation n'est posée.
 */
export const ModerationDecisionFactory = factory
  .define(ModerationDecisionRecord, ({ faker }) => ({
    targetType: 'product' as const,
    targetId: faker.number.int({ min: 1, max: 100000 }),
    status: 'approved' as const,
    reason: null,
    decidedAt: DateTime.now(),
  }))
  .state('rejected', (decision) => {
    decision.status = 'rejected'
    decision.reason = 'Informations incomplètes'
  })
  .state('organization', (decision) => {
    decision.targetType = 'organization'
  })
  .build()
