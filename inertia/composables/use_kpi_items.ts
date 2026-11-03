import { computed } from 'vue'
import {
  Activity,
  ArrowRightLeft,
  Ban,
  Building2,
  CircleCheck,
  CircleX,
  Clock,
  FileCheck,
  FileText,
  Reply,
  Send,
  ShoppingCart,
  Timer,
  Truck,
  UserPlus,
} from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import type { KpiItem } from '~/components/admin/types'
import type { AdminKpiReport } from '#shared/types/admin_kpi'

/**
 * Indicateurs des groupes comptes, demandes de devis, devis et commandes du
 * tableau de bord KPI : libellé, valeur comparée, format et icône. `report` est un
 * getter pour rester réactif quand la période change.
 */
export function useKpiItems(report: () => AdminKpiReport) {
  const { t } = useI18n()
  const label = (key: string) => t(`admin.dashboard.kpi.metrics.${key}`)

  const accounts = computed<KpiItem[]>(() => [
    {
      key: 'newOrganizations',
      label: label('newOrganizations'),
      metric: report().accounts.newOrganizations,
      format: 'count',
      icon: Building2,
    },
    {
      key: 'newUsers',
      label: label('newUsers'),
      metric: report().accounts.newUsers,
      format: 'count',
      icon: UserPlus,
    },
    {
      key: 'activeUsers',
      label: label('activeUsers'),
      metric: report().accounts.activeUsers,
      format: 'count',
      icon: Activity,
    },
  ])

  const rfqs = computed<KpiItem[]>(() => [
    {
      key: 'rfqsCreated',
      label: label('rfqsCreated'),
      metric: report().rfqs.created,
      format: 'count',
      icon: FileText,
    },
    {
      key: 'rfqsPublished',
      label: label('rfqsPublished'),
      metric: report().rfqs.published,
      format: 'count',
      icon: Send,
    },
    {
      key: 'publicationDelay',
      label: label('publicationDelay'),
      metric: report().rfqs.publicationDelayHours,
      format: 'hours',
      icon: Clock,
    },
    {
      key: 'responseRate',
      label: label('responseRate'),
      metric: report().rfqs.supplierResponseRate,
      format: 'percent',
      icon: Reply,
    },
    {
      key: 'declineRate',
      label: label('declineRate'),
      metric: report().rfqs.supplierDeclineRate,
      format: 'percent',
      icon: Ban,
    },
  ])

  const quotes = computed<KpiItem[]>(() => [
    {
      key: 'quotesSubmitted',
      label: label('quotesSubmitted'),
      metric: report().quotes.submitted,
      format: 'count',
      icon: FileCheck,
    },
    {
      key: 'quotesAccepted',
      label: label('quotesAccepted'),
      metric: report().quotes.accepted,
      format: 'count',
      icon: CircleCheck,
    },
    {
      key: 'quotesRejected',
      label: label('quotesRejected'),
      metric: report().quotes.rejected,
      format: 'count',
      icon: CircleX,
    },
    {
      key: 'decisionDelay',
      label: label('decisionDelay'),
      metric: report().quotes.decisionDelayHours,
      format: 'hours',
      icon: Timer,
    },
  ])

  const orders = computed<KpiItem[]>(() => [
    {
      key: 'ordersCreated',
      label: label('ordersCreated'),
      metric: report().orders.created,
      format: 'count',
      icon: ShoppingCart,
    },
    {
      key: 'quoteToOrder',
      label: label('quoteToOrder'),
      metric: report().orders.quoteToOrderRate,
      format: 'percent',
      icon: ArrowRightLeft,
    },
    {
      key: 'deliveryDelay',
      label: label('deliveryDelay'),
      metric: report().orders.deliveryDelayHours,
      format: 'hours',
      icon: Truck,
    },
  ])

  return { accounts, rfqs, quotes, orders }
}
