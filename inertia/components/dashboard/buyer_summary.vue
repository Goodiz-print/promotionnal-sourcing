<script setup lang="ts">
import type { Component } from 'vue'
import { Link } from '@adonisjs/inertia/vue'
import { CheckCircle2, Clock, FileText, MessageSquareReply, Send } from 'lucide-vue-next'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseStat from '~/components/base/base_stat.vue'
import { RFQ_SUPPLIER_STATUS_TONES } from '~/components/rfqs/types'
import { RFQ_STATUSES, type RfqStatus } from '#shared/types/rfq'
import type { BuyerDashboardType } from '#shared/types/dashboard'

defineProps<{ buyer: BuyerDashboardType }>()

const { t, locale } = useI18n()

/** Icône du compteur par statut de demande : brouillon, publiée, clôturée, échue. */
const RFQ_STATUS_ICONS: Record<RfqStatus, Component> = {
  draft: FileText,
  published: Send,
  closed: CheckCircle2,
  expired: Clock,
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(locale.value)
}
</script>

<template>
  <section class="flex flex-col gap-4" data-testid="buyer-summary">
    <h2 class="text-heading-lg text-text-primary">{{ t('dashboard.buyer.title') }}</h2>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <BaseStat
        v-for="status in RFQ_STATUSES"
        :key="status"
        :label="t(`dashboard.buyer.status.${status}`)"
        :value="buyer.rfqCounts[status]"
        :icon="RFQ_STATUS_ICONS[status]"
        :href="urlFor('rfqs.index', { locale })"
      />
    </div>

    <BaseSection :title="t('dashboard.buyer.recent.title')">
      <template #actions>
        <Link
          :href="urlFor('rfqs.index', { locale })"
          class="text-body-sm font-semibold text-indigo-600 hover:underline"
        >
          {{ t('dashboard.buyer.viewAll') }}
        </Link>
      </template>

      <BaseEmptyState
        v-if="buyer.recentResponses.length === 0"
        compact
        :icon="MessageSquareReply"
        :title="t('dashboard.buyer.recent.empty')"
      />
      <ul v-else class="-my-3 flex flex-col">
        <li
          v-for="response in buyer.recentResponses"
          :key="`${response.rfqId}-${response.supplierName}`"
          class="flex items-center gap-3 border-b border-hairline py-3 last:border-0"
        >
          <span
            class="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-subtle text-indigo-600"
            aria-hidden="true"
          >
            <MessageSquareReply :size="18" />
          </span>
          <span class="flex min-w-0 flex-1 flex-col">
            <Link
              :href="urlFor('rfqs.show', { locale, id: response.rfqId })"
              class="truncate text-body-sm font-semibold text-text-primary hover:text-indigo-600 hover:underline"
            >
              {{
                t('dashboard.buyer.recent.item', {
                  supplier: response.supplierName,
                  rfq: response.rfqTitle,
                })
              }}
            </Link>
            <span class="text-tabular text-caption text-text-muted">
              {{ formatDate(response.respondedAt) }}
            </span>
          </span>
          <BaseBadge :tone="RFQ_SUPPLIER_STATUS_TONES.responded" dot>
            {{ t('rfq.supplierStatus.responded') }}
          </BaseBadge>
        </li>
      </ul>
    </BaseSection>
  </section>
</template>
