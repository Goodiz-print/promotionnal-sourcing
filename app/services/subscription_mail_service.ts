import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import SendMailJob from '#jobs/send_mail_job'
import { dueReminderDays } from '#shared/helpers/subscription'
import { mailIdempotencyKey } from '#shared/helpers/mail'
import type { Locale } from '#shared/types/i18n'
import { MAIL_KINDS, type SendMailPayload } from '#shared/types/mail'
import {
  SUBSCRIPTION_REMINDER_DAYS,
  SUBSCRIPTION_TIMEZONE,
  type DueSubscriptionReminder,
  type SubscriptionMailRecipient,
  type SubscriptionMailRow,
} from '#shared/types/subscription'

/** Rôles prévenus des mails d'abonnement : responsables de l'organisation. */
const SUBSCRIPTION_MAIL_ROLES = ['owner', 'admin'] as const

/**
 * Mails d'abonnement manuel (#237) : activation, puis rappels avant la fin (30
 * jours pour un annuel, 7 jours pour tous). Chaque envoi est d'abord
 * **réservé** en base (`activation_notified_at`, `reminded_ends_at` +
 * `reminded_days`) par une mise à jour conditionnelle : deux passages
 * concurrents du job ne réservent pas le même mail. Les mails partent ensuite
 * par `SendMailJob` (idempotence `mail_deliveries`). Les abonnements en ligne
 * sont exclus : Stripe les renouvelle et envoie ses propres reçus.
 *
 * Accès par `db`, sans modèle Lucid : `SyncSubscriptionsJob` l'injecte par son
 * constructeur (la queue charge les jobs au boot, cf. `CLAUDE.md`).
 */
export default class SubscriptionMailService {
  /**
   * Prévient les responsables de chaque abonnement manuel devenu actif et pas
   * encore annoncé. Renvoie le nombre d'abonnements annoncés.
   */
  async notifyActivations(now: DateTime = DateTime.now()): Promise<number> {
    const claimed: Array<{ id: number }> = await db
      .from('organization_subscriptions')
      .where('status', 'active')
      .whereNull('stripe_subscription_id')
      .whereNull('activation_notified_at')
      .update({ activation_notified_at: now.toSQL() }, ['id'])
    if (claimed.length === 0) return 0

    const subscriptions = await this.rows().whereIn(
      'subscriptions.id',
      claimed.map((row) => row.id)
    )
    await this.mailEach(subscriptions, (subscription, recipient) =>
      activationMail(subscription, recipient)
    )
    return subscriptions.length
  }

  /**
   * Envoie les rappels d'échéance dus à l'instant `now` (cf. `dueReminderDays`).
   * Renvoie le nombre d'abonnements rappelés.
   */
  async remindExpiring(now: DateTime = DateTime.now()): Promise<number> {
    const horizon = now.plus({ days: Math.max(...SUBSCRIPTION_REMINDER_DAYS.annual) })
    const candidates: SubscriptionMailRow[] = await this.rows()
      .whereNull('subscriptions.stripe_subscription_id')
      .where('subscriptions.status', 'active')
      .where('subscriptions.ends_at', '>', now.toSQL()!)
      .where('subscriptions.ends_at', '<=', horizon.toSQL()!)

    const due = candidates
      .map((subscription) => ({
        subscription,
        days: dueReminderDays(reminderState(subscription), now.toJSDate()),
      }))
      .filter((entry): entry is DueSubscriptionReminder => entry.days !== null)
    const claims = await Promise.all(due.map((entry) => this.claimReminder(entry)))
    const claimed = claims.filter((entry): entry is DueSubscriptionReminder => entry !== null)
    if (claimed.length === 0) return 0

    const days = new Map(claimed.map((entry) => [entry.subscription.id, entry.days]))
    await this.mailEach(
      claimed.map((entry) => entry.subscription),
      (subscription, recipient) =>
        reminderMail({ subscription, days: days.get(subscription.id)! }, recipient, now)
    )
    return claimed.length
  }

  /**
   * Réserve un rappel : n'écrit que si aucun rappel aussi proche n'est déjà
   * parti pour cette date de fin (passage concurrent, prolongation entre-temps).
   */
  private async claimReminder(
    entry: DueSubscriptionReminder
  ): Promise<DueSubscriptionReminder | null> {
    const { subscription, days } = entry
    const endsAt = DateTime.fromJSDate(subscription.ends_at!).toSQL()
    const updated = await db
      .from('organization_subscriptions')
      .where('id', subscription.id)
      .where('ends_at', endsAt!)
      .where((query) =>
        query
          .whereNull('reminded_ends_at')
          .orWhereRaw('reminded_ends_at <> ends_at')
          .orWhere('reminded_days', '>', days)
      )
      .update({ reminded_ends_at: endsAt, reminded_days: days })
    return Number(updated) > 0 ? entry : null
  }

  /** Abonnements avec le nom de leur organisation. */
  private rows() {
    return db
      .from('organization_subscriptions as subscriptions')
      .join('organizations', 'organizations.id', 'subscriptions.organization_id')
      .select(
        'subscriptions.id',
        'subscriptions.organization_id',
        'organizations.name as organization_name',
        'subscriptions.plan',
        'subscriptions.starts_at',
        'subscriptions.ends_at',
        'subscriptions.reminded_ends_at',
        'subscriptions.reminded_days'
      )
  }

  /** Met en queue un mail par abonnement et par responsable de son organisation. */
  private async mailEach(
    subscriptions: SubscriptionMailRow[],
    build: (row: SubscriptionMailRow, recipient: SubscriptionMailRecipient) => SendMailPayload
  ): Promise<void> {
    const recipients = await this.recipientsOf(subscriptions.map((row) => row.organization_id))
    await Promise.all(
      subscriptions.flatMap((subscription) =>
        (recipients.get(subscription.organization_id) ?? []).map((recipient) =>
          this.dispatch(build(subscription, recipient))
        )
      )
    )
  }

  /** Responsables (owner, admin) de chaque organisation, dédoublonnés par email. */
  private async recipientsOf(
    organizationIds: number[]
  ): Promise<Map<number, SubscriptionMailRecipient[]>> {
    const members: Array<{ organization_id: number; email: string; locale: Locale }> = await db
      .from('organization_users')
      .join('users', 'users.id', 'organization_users.user_id')
      .join('roles', 'roles.id', 'organization_users.role_id')
      .whereIn('organization_users.organization_id', organizationIds)
      .whereIn('roles.slug', [...SUBSCRIPTION_MAIL_ROLES])
      .distinct('organization_users.organization_id', 'users.email', 'users.locale')
    const byOrganization = Map.groupBy(members, (member) => member.organization_id)
    return new Map(
      [...byOrganization].map(([organizationId, rows]) => [
        organizationId,
        rows.map(({ email, locale }) => ({ email, locale })),
      ])
    )
  }

  /** Mise en queue ; un échec est loggé sans bloquer les autres envois. */
  private async dispatch(payload: SendMailPayload): Promise<void> {
    try {
      await SendMailJob.dispatch(payload)
    } catch (error) {
      logger.warn({ err: error, kind: payload.kind }, 'failed to queue subscription mail')
    }
  }
}

const iso = (value: Date) => value.toISOString()

function reminderState(row: SubscriptionMailRow) {
  return {
    startsAt: iso(row.starts_at),
    endsAt: iso(row.ends_at!),
    remindedEndsAt: row.reminded_ends_at ? iso(row.reminded_ends_at) : null,
    remindedDays: row.reminded_days,
  }
}

/** Jour formaté dans la langue du destinataire, heure de Paris. */
function formatDay(instant: Date, locale: Locale): string {
  return DateTime.fromJSDate(instant)
    .setZone(SUBSCRIPTION_TIMEZONE)
    .setLocale(locale)
    .toLocaleString(DateTime.DATE_FULL)
}

/** Dernier jour couvert : la fin est exclusive (début du jour suivant). */
function lastDay(row: SubscriptionMailRow): Date | null {
  return row.ends_at ? new Date(row.ends_at.getTime() - 1) : null
}

const pricingPath = (locale: Locale) => `/${locale}/supplier/subscription`

function activationMail(
  row: SubscriptionMailRow,
  { email, locale }: SubscriptionMailRecipient
): SendMailPayload {
  const end = lastDay(row)
  return {
    kind: MAIL_KINDS.subscriptionActivated,
    idempotencyKey: mailIdempotencyKey(MAIL_KINDS.subscriptionActivated, {
      subscription: row.id,
      to: email,
    }),
    to: email,
    locale,
    data: {
      organizationName: row.organization_name,
      plan: row.plan,
      startsOn: formatDay(row.starts_at, locale),
      endsOn: end ? formatDay(end, locale) : null,
      path: pricingPath(locale),
    },
  }
}

function reminderMail(
  { subscription, days }: DueSubscriptionReminder,
  { email, locale }: SubscriptionMailRecipient,
  now: DateTime
): SendMailPayload {
  const endsAt = DateTime.fromJSDate(subscription.ends_at!)
  return {
    kind: MAIL_KINDS.subscriptionExpiring,
    idempotencyKey: mailIdempotencyKey(MAIL_KINDS.subscriptionExpiring, {
      subscription: subscription.id,
      ends: endsAt.toMillis(),
      days,
      to: email,
    }),
    to: email,
    locale,
    data: {
      organizationName: subscription.organization_name,
      plan: subscription.plan,
      endsOn: formatDay(lastDay(subscription)!, locale),
      daysLeft: Math.max(1, Math.ceil(endsAt.diff(now, 'days').days)),
      path: pricingPath(locale),
    },
  }
}
