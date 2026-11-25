<script setup lang="ts">
import { Link } from '@adonisjs/inertia/vue'
import { FileCheck, ShoppingCart } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { formatShortDate } from '#shared/helpers/date'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseTable from '~/components/base/base_table.vue'
import { RFQ_PROGRESS_TONES } from '~/components/rfqs/types'
import type { RfqBatchGroupType } from '#shared/types/rfq'

/**
 * Tableau de « Mes demandes » (#228). Les demandes d'un même panier (#229)
 * sont regroupées sous une ligne d'en-tête ; une demande hors panier est une
 * ligne seule.
 */
defineProps<{ groups: RfqBatchGroupType[] }>()

const { t, locale } = useI18n()

/** Date courte dans la langue de l'interface (lie `formatShortDate` à la locale courante). */
function formatDate(value: string): string {
  return formatShortDate(value, locale.value)
}
</script>

<template>
  <BaseTable :caption="t('rfq.index.title')">
    <template #head>
      <tr>
        <th scope="col">{{ t('rfq.index.columns.title') }}</th>
        <th scope="col">{{ t('rfq.index.columns.author') }}</th>
        <th scope="col">{{ t('rfq.index.columns.status') }}</th>
        <th scope="col" class="text-right">{{ t('rfq.index.columns.responses') }}</th>
        <th scope="col">{{ t('rfq.index.columns.quotes') }}</th>
        <th scope="col">{{ t('rfq.index.columns.deadline') }}</th>
      </tr>
    </template>

    <template v-for="group in groups" :key="group.key">
      <tr v-if="group.batchId" data-batch-header class="bg-sunken">
        <th scope="colgroup" colspan="6" class="text-left">
          <span class="flex items-center gap-2 text-body-sm font-semibold text-text-secondary">
            <ShoppingCart :size="16" aria-hidden="true" />
            {{
              t('rfq.index.batch', {
                date: formatDate(group.rfqs[0].createdAt),
                count: group.rfqs.length,
              })
            }}
          </span>
        </th>
      </tr>
      <tr v-for="rfq in group.rfqs" :key="rfq.id" :data-batch="group.batchId ?? undefined">
        <td :class="group.batchId ? 'pl-8' : ''">
          <Link
            route="rfqs.show"
            :params="{ locale, id: rfq.id }"
            class="font-semibold text-text-primary hover:text-indigo-600"
          >
            {{ rfq.title }}
          </Link>
        </td>
        <td class="text-text-secondary">
          {{ rfq.createdByName ?? t('rfq.index.unknownAuthor') }}
        </td>
        <td>
          <BaseBadge dot :tone="RFQ_PROGRESS_TONES[rfq.progress]">
            {{ t(`rfq.index.progress.${rfq.progress}`) }}
          </BaseBadge>
        </td>
        <td class="text-tabular text-right">
          {{
            t('rfq.index.responses', { responded: rfq.respondedCount, total: rfq.supplierCount })
          }}
        </td>
        <td>
          <BaseBadge v-if="rfq.hasReceivedQuote" tone="success">
            <FileCheck :size="14" aria-hidden="true" />
            {{ t('rfq.index.quoteReceived') }}
          </BaseBadge>
        </td>
        <td class="text-tabular whitespace-nowrap">
          <template v-if="rfq.deadline">{{ formatDate(rfq.deadline) }}</template>
          <span v-else class="text-text-muted">{{ t('rfq.show.noDeadline') }}</span>
        </td>
      </tr>
    </template>
  </BaseTable>
</template>
