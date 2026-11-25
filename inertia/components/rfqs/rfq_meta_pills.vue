<script setup lang="ts">
import { computed, type Component } from 'vue'
import { CalendarDays, UserRound, Users, Wallet } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { formatShortDate } from '#shared/helpers/date'
import type { RfqDetailType } from '#shared/types/rfq'

/**
 * Pills de métadonnées sous le titre d'une demande : échéance, destinataires,
 * puis budget et auteur quand ils sont renseignés. Rendu en fragment pour
 * s'insérer dans le slot `meta` de `BasePageHeader`, à côté du badge de statut.
 */
const props = defineProps<{ rfq: RfqDetailType }>()

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

const pills = computed<MetaPill[]>(() => {
  const rfq = props.rfq
  const list: MetaPill[] = [
    {
      key: 'deadline',
      icon: CalendarDays,
      label: rfq.deadline
        ? t('rfq.show.deadline', { date: formatDate(rfq.deadline) })
        : t('rfq.show.noDeadline'),
    },
    {
      key: 'suppliers',
      icon: Users,
      label: t('rfq.index.supplierCount', { count: rfq.supplierCount }),
    },
  ]
  if (rfq.budgetMax) {
    list.push({
      key: 'budget',
      icon: Wallet,
      label: t('rfq.show.budget', { amount: rfq.budgetMax }),
    })
  }
  if (rfq.createdByName) {
    list.push({
      key: 'author',
      icon: UserRound,
      label: t('rfq.show.createdBy', { name: rfq.createdByName }),
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
