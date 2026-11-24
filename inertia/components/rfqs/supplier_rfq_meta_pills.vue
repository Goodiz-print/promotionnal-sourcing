<script setup lang="ts">
import { computed, type Component } from 'vue'
import { CalendarDays, EyeOff, Inbox, ListChecks, UserRound } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { formatShortDate } from '#shared/helpers/date'
import type { SupplierRfqType } from '#shared/types/rfq'

/**
 * Pills de métadonnées d'une demande vue par son destinataire : acheteur,
 * échéance, nombre de lignes, date de réception. L'acheteur reste anonyme pour
 * un fournisseur non abonné (#220) : `buyerName` vaut alors `null`. Pendant fournisseur de
 * `RfqMetaPills` — sans le budget ni l'auteur, que l'acheteur garde pour lui.
 * Rendu en fragment pour le slot `meta` de `BasePageHeader`.
 */
const props = defineProps<{ rfq: SupplierRfqType }>()

const { t, locale } = useI18n()

interface MetaPill {
  key: string
  icon: Component
  label: string
}

/** Date courte dans la langue de l'interface (lie `formatShortDate` à la locale courante). */
function formatDate(value: string): string {
  return formatShortDate(value, locale.value)
}

/** L'acheteur, ou la mention « agence anonyme » pour un non abonné. */
function buyerPill(name: string | null): MetaPill {
  if (name === null) return { key: 'buyer', icon: EyeOff, label: t('rfq.supplier.anonymousBuyer') }
  return { key: 'buyer', icon: UserRound, label: t('rfq.supplier.index.from', { name }) }
}

const pills = computed<MetaPill[]>(() => {
  const rfq = props.rfq
  const list: MetaPill[] = [
    buyerPill(rfq.buyerName),
    {
      key: 'deadline',
      icon: CalendarDays,
      label: rfq.deadline
        ? t('rfq.show.deadline', { date: formatDate(rfq.deadline) })
        : t('rfq.supplier.show.noDeadline'),
    },
    {
      key: 'items',
      icon: ListChecks,
      label: t('rfq.index.itemCount', { count: rfq.itemCount }),
    },
  ]
  if (rfq.sentAt) {
    list.push({
      key: 'receivedAt',
      icon: Inbox,
      label: t('rfq.supplier.index.receivedAt', { date: formatDate(rfq.sentAt) }),
    })
  }
  return list
})
</script>

<template>
  <span
    v-for="pill in pills"
    :key="pill.key"
    class="inline-flex items-center gap-1.5 rounded-pill border border-hairline bg-card px-3 py-1 text-caption text-text-secondary"
  >
    <component :is="pill.icon" :size="14" aria-hidden="true" />
    {{ pill.label }}
  </span>
</template>
