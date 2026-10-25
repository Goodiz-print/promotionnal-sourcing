import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import emitter from '@adonisjs/core/services/emitter'
import OrganizationCatalogueChanged from '#events/organization_catalogue_changed'
import ProductChanged from '#events/product_changed'
import ModerationDecisionRecord from '#models/moderation_decision'
import User from '#models/user'
import { InvalidModerationInputException } from '#exceptions/moderation_errors'
import {
  MODERATION_DECISIONS,
  MODERATION_TARGET_TYPES,
  type ModerationDecision,
  type ModerationStatus,
  type ModerationTargetType,
} from '#shared/types/moderation'

interface DecideInput {
  targetType: ModerationTargetType
  targetId: number
  status: ModerationDecision
  decidedBy: User
  reason?: string | null
}

/**
 * Modération (#54) : historique en ajout seul. Le statut courant d'une cible est
 * la dernière décision ; sans décision, la cible est `pending`.
 *
 * Ce service ne décide pas quoi modérer : il expose le mécanisme. Brancher une
 * cible (organisation, produit) = appeler `currentStatus` avant de l'afficher ou
 * de la publier.
 */
@inject()
export default class ModerationService {
  async decide(input: DecideInput): Promise<ModerationDecisionRecord> {
    this.assertTarget(input.targetType)
    if (!(MODERATION_DECISIONS as readonly string[]).includes(input.status)) {
      throw new InvalidModerationInputException()
    }
    const record = await ModerationDecisionRecord.create({
      targetType: input.targetType,
      targetId: input.targetId,
      status: input.status,
      reason: input.reason ?? null,
      decidedByUserId: input.decidedBy.id,
      decidedAt: DateTime.now(),
    })

    // Un rejet (ou sa levée) change la visibilité du produit, ou de tout le
    // catalogue de l'organisation : l'index de recherche suit.
    if (input.targetType === 'product') {
      await emitter.emit(ProductChanged, new ProductChanged(input.targetId))
    } else if (input.targetType === 'organization') {
      await emitter.emit(
        OrganizationCatalogueChanged,
        new OrganizationCatalogueChanged(input.targetId)
      )
    }
    return record
  }

  /** Statut courant : la dernière décision, ou `pending` si la cible n'en a aucune. */
  async currentStatus(
    targetType: ModerationTargetType,
    targetId: number
  ): Promise<ModerationStatus> {
    this.assertTarget(targetType)
    const latest = await this.history(targetType, targetId).first()
    return latest ? latest.status : 'pending'
  }

  /** Historique complet, le plus récent d'abord. */
  history(targetType: ModerationTargetType, targetId: number) {
    return ModerationDecisionRecord.query()
      .where('targetType', targetType)
      .where('targetId', targetId)
      .orderBy('decidedAt', 'desc')
      .orderBy('id', 'desc')
  }

  private assertTarget(targetType: string): void {
    if (!(MODERATION_TARGET_TYPES as readonly string[]).includes(targetType)) {
      throw new InvalidModerationInputException()
    }
  }
}
