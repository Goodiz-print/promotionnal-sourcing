import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import emitter from '@adonisjs/core/services/emitter'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
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
  /**
   * Enregistre une décision. Avec `client` (transaction d'une action tracée), la
   * décision s'écrit dans cette transaction et la réindexation n'est émise
   * qu'une fois la transaction validée.
   */
  async decide(
    input: DecideInput,
    client?: TransactionClientContract
  ): Promise<ModerationDecisionRecord> {
    this.assertTarget(input.targetType)
    if (!(MODERATION_DECISIONS as readonly string[]).includes(input.status)) {
      throw new InvalidModerationInputException()
    }
    const record = await ModerationDecisionRecord.create(
      {
        targetType: input.targetType,
        targetId: input.targetId,
        status: input.status,
        reason: input.reason ?? null,
        decidedByUserId: input.decidedBy.id,
        decidedAt: DateTime.now(),
      },
      client ? { client } : undefined
    )

    // Un rejet (ou sa levée) change la visibilité du produit, ou de tout le
    // catalogue de l'organisation : l'index de recherche suit.
    const reindex = () => this.reindex(input.targetType, input.targetId)
    if (client) client.after('commit', reindex)
    else await reindex()
    return record
  }

  private async reindex(targetType: ModerationTargetType, targetId: number): Promise<void> {
    if (targetType === 'product') {
      await emitter.emit(ProductChanged, new ProductChanged(targetId))
    } else if (targetType === 'organization') {
      await emitter.emit(OrganizationCatalogueChanged, new OrganizationCatalogueChanged(targetId))
    }
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
