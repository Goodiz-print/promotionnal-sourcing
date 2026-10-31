import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import AdminAuditLog from '#models/admin_audit_log'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import type {
  AdminActionContext,
  AdminAuditEntry,
  AdminAuditFilters,
} from '#shared/types/admin_audit'

interface RecordOptions extends AdminActionContext {
  /** Transaction de l'action tracée : l'entrée est écrite avec elle ou pas du tout. */
  client: TransactionClientContract
}

interface ListOptions extends AdminAuditFilters {
  page: number
  perPage: number
}

/**
 * Contexte d'une action admin déclenchée par une requête HTTP : l'utilisateur
 * connecté et son adresse IP.
 */
export function adminActionContext({
  auth,
  request,
}: Pick<HttpContext, 'auth' | 'request'>): AdminActionContext {
  const user = auth.getUserOrFail()
  return { actor: { id: user.id, email: user.email }, ip: request.ip() }
}

/**
 * Journal d'audit du back-office (#159). En ajout seul : `record` et `list` sont
 * les seules entrées, il n'existe volontairement ni mise à jour ni suppression.
 */
export default class AdminAuditService {
  /**
   * Écrit une entrée dans la transaction de l'action qu'elle trace : si
   * l'action est annulée, l'entrée l'est aussi.
   */
  async record(entry: AdminAuditEntry, options: RecordOptions): Promise<AdminAuditLog> {
    const { actor, ip, client } = options

    return AdminAuditLog.create(
      {
        actorUserId: actor?.id ?? null,
        actorEmail: actor?.email ?? null,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        changes: entry.changes ?? null,
        ipAddress: ip,
      },
      { client }
    )
  }

  /**
   * Liste paginée, la plus récente d'abord. L'email de l'acteur est cherché en
   * partiel et sans casse ; les bornes de date sont incluses (jour entier).
   */
  list(options: ListOptions): Promise<ModelPaginatorContract<AdminAuditLog>> {
    const { page, perPage, action, targetType, actor, from, to } = options

    return AdminAuditLog.query()
      .if(action, (query) => query.where('action', action!))
      .if(targetType, (query) => query.where('target_type', targetType!))
      .if(actor, (query) => query.whereILike('actor_email', `%${escapeLike(actor!)}%`))
      .if(from, (query) => query.where('created_at', '>=', startOfDay(from!).toJSDate()))
      .if(to, (query) =>
        query.where('created_at', '<', startOfDay(to!).plus({ days: 1 }).toJSDate())
      )
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')
      .paginate(page, perPage)
  }
}

function startOfDay(isoDate: string): DateTime {
  return DateTime.fromISO(isoDate).startOf('day')
}

/**
 * Neutralise les jokers `%` et `_` (et l'échappement) d'une saisie utilisateur
 * avant de l'insérer dans un motif `ILIKE`.
 */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}
