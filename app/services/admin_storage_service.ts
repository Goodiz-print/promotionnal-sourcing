import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import RecoverStorageUploadsJob from '#jobs/recover_storage_uploads_job'
import AdminAuditService from '#services/admin_audit_service'
import {
  STORAGE_ORGANIZATION_LIMIT,
  STORAGE_STALE_LIST_LIMIT,
  type AdminStorageOrganizationRow,
  type AdminStorageOverview,
  type AdminStorageStaleRow,
  type AdminStorageStatusTotal,
} from '#shared/types/admin_ops'
import type { AdminActionContext } from '#shared/types/admin_audit'
import {
  STORAGE_RECOVERY_THRESHOLD_HOURS,
  STORAGE_REFERENCES,
  STORAGE_STATUSES,
  type StorageStatus,
} from '#shared/types/storage'

type StorageReference = (typeof STORAGE_REFERENCES)[number]
type ReferenceKey = StorageReference extends infer R
  ? R extends { table: infer T extends string; column: infer C extends string }
    ? `${T}.${C}`
    : never
  : never

/**
 * Propriétaire (organisation) de chaque colonne qui référence `storage_objects`,
 * sous la forme d'un `SELECT organization_id, object_id`. Typé par
 * `STORAGE_REFERENCES` : ajouter une colonne référençante sans dire à qui elle
 * appartient est une erreur de compilation — le volume par organisation resterait
 * sinon silencieusement incomplet.
 */
const OWNER_SELECTS: Record<ReferenceKey, string> = {
  'product_images.storage_object_id': `
    SELECT s.organization_id, pi.storage_object_id AS object_id
    FROM product_images pi
    JOIN products p ON p.id = pi.product_id
    JOIN suppliers s ON s.id = p.supplier_id`,
  'product_image_variants.storage_object_id': `
    SELECT s.organization_id, v.storage_object_id AS object_id
    FROM product_image_variants v
    JOIN product_images pi ON pi.id = v.product_image_id
    JOIN products p ON p.id = pi.product_id
    JOIN suppliers s ON s.id = p.supplier_id`,
  'organizations.logo_storage_object_id': `
    SELECT id AS organization_id, logo_storage_object_id AS object_id FROM organizations`,
  'organizations.banner_storage_object_id': `
    SELECT id AS organization_id, banner_storage_object_id AS object_id FROM organizations`,
  'supplier_news.image_storage_object_id': `
    SELECT organization_id, image_storage_object_id AS object_id FROM supplier_news`,
  'organization_documents.storage_object_id': `
    SELECT organization_id, storage_object_id AS object_id FROM organization_documents`,
  'product_documents.storage_object_id': `
    SELECT s.organization_id, d.storage_object_id AS object_id
    FROM product_documents d
    JOIN products p ON p.id = d.product_id
    JOIN suppliers s ON s.id = p.supplier_id`,
}

/** Couples (organisation, objet) distincts : un objet référencé deux fois par la même organisation compte une fois. */
const OWNED_PAIRS = `
  WITH pairs AS MATERIALIZED (
    SELECT DISTINCT organization_id, object_id FROM (
      ${Object.values(OWNER_SELECTS).join('\n      UNION ALL\n')}
    ) owned
    WHERE organization_id IS NOT NULL AND object_id IS NOT NULL
  )`

const PENDING_STATUSES: readonly StorageStatus[] = ['pending_upload', 'pending_delete']

/**
 * Supervision du stockage Cellar (#178) : registre `storage_objects` (arriéré
 * `pending_*`, volume), et relance de la reprise (`RecoverStorageUploadsJob`, le
 * même job que le planning `recover-storage-uploads`). Lecture seule hors relance :
 * ni l'objet ni sa ligne ne sont supprimés d'ici.
 *
 * Accès par `db` : on ne lit que le registre, jamais le bucket.
 */
@inject()
export default class AdminStorageService {
  constructor(private audit: AdminAuditService) {}

  async overview(): Promise<AdminStorageOverview> {
    const threshold = DateTime.now().minus({ hours: STORAGE_RECOVERY_THRESHOLD_HOURS }).toJSDate()

    const [totals, stale, staleCount, ownership] = await Promise.all([
      this.totals(),
      this.stale(threshold),
      this.staleCount(threshold),
      this.ownership(),
    ])

    const readyBytes = totals.find((total) => total.status === 'ready')?.bytes ?? 0
    return {
      totals,
      thresholdHours: STORAGE_RECOVERY_THRESHOLD_HOURS,
      staleCount,
      stale,
      unattributedBytes: Math.max(0, readyBytes - ownership.attributedBytes),
      organizations: ownership.organizations,
    }
  }

  /**
   * Relance la reprise du stockage maintenant : nettoie les envois interrompus et
   * rejoue les purges perdues de plus de `STORAGE_RECOVERY_THRESHOLD_HOURS`. Le job est
   * idempotent (verrou par clé) ; l'audit est écrit avant la mise en queue.
   */
  async requestRecovery(context: AdminActionContext): Promise<void> {
    await db.transaction(async (trx) => {
      await this.audit.record(
        {
          action: 'storage.recovery_requested',
          targetType: 'storage',
          targetId: null,
          changes: { after: { stale: await this.staleCount(this.threshold(), trx) } },
        },
        { ...context, client: trx }
      )
    })
    await RecoverStorageUploadsJob.dispatch({})
  }

  private threshold(): Date {
    return DateTime.now().minus({ hours: STORAGE_RECOVERY_THRESHOLD_HOURS }).toJSDate()
  }

  private async totals(): Promise<AdminStorageStatusTotal[]> {
    const rows = await db
      .from('storage_objects')
      .select('status')
      .count('* as total')
      .sum('size as bytes')
      .groupBy('status')

    return STORAGE_STATUSES.map((status) => {
      const row = rows.find((candidate) => candidate.status === status)
      return { status, count: Number(row?.total ?? 0), bytes: Number(row?.bytes ?? 0) }
    })
  }

  private async stale(threshold: Date): Promise<AdminStorageStaleRow[]> {
    const rows = await db
      .from('storage_objects')
      .whereIn('status', [...PENDING_STATUSES])
      .where('created_at', '<', threshold)
      .select('id', 'key', 'status', 'size', 'created_at')
      .orderBy('created_at', 'asc')
      .orderBy('id', 'asc')
      .limit(STORAGE_STALE_LIST_LIMIT)

    return rows.map((row) => ({
      id: row.id,
      key: row.key,
      status: row.status,
      size: Number(row.size),
      createdAt: new Date(row.created_at).toISOString(),
    }))
  }

  private async staleCount(threshold: Date, client: Pick<typeof db, 'from'> = db): Promise<number> {
    const row = await client
      .from('storage_objects')
      .whereIn('status', [...PENDING_STATUSES])
      .where('created_at', '<', threshold)
      .count('* as total')
      .first()
    return Number(row?.total ?? 0)
  }

  /**
   * Volume rattaché aux organisations, en **une** requête : le CTE `pairs` (jointures
   * sur toutes les tables d'images) est référencé deux fois, donc matérialisé une seule
   * fois par PostgreSQL. Retourne les plus volumineuses et le total des octets `ready`
   * référencés par au moins une organisation (chaque objet une seule fois).
   */
  private async ownership(): Promise<{
    organizations: AdminStorageOrganizationRow[]
    attributedBytes: number
  }> {
    const result = await db.rawQuery(
      `${OWNED_PAIRS},
       per_organization AS (
         SELECT o.id AS organization_id, o.name, count(*) AS total, sum(so.size) AS bytes
         FROM pairs
         JOIN storage_objects so ON so.id = pairs.object_id AND so.status = 'ready'
         JOIN organizations o ON o.id = pairs.organization_id
         GROUP BY o.id, o.name
         ORDER BY bytes DESC, o.id ASC
         LIMIT ?
       )
       SELECT organization_id, name, total, bytes, FALSE AS summary FROM per_organization
       UNION ALL
       SELECT NULL, NULL, NULL, coalesce(sum(size), 0), TRUE
       FROM storage_objects
       WHERE status = 'ready' AND id IN (SELECT object_id FROM pairs)`,
      [STORAGE_ORGANIZATION_LIMIT]
    )

    const rows = result.rows as {
      organization_id: number | null
      name: string | null
      total: string | null
      bytes: string
      summary: boolean
    }[]
    return {
      organizations: rows
        .filter((row) => !row.summary)
        .map((row) => ({
          organizationId: row.organization_id!,
          name: row.name!,
          count: Number(row.total),
          bytes: Number(row.bytes),
        })),
      attributedBytes: Number(rows.find((row) => row.summary)?.bytes ?? 0),
    }
  }
}
