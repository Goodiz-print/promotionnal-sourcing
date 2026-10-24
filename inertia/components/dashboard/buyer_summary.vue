<script setup lang="ts">
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import BaseStat from '~/components/base/base_stat.vue'
import { RFQ_STATUSES } from '#shared/types/rfq'
import type { BuyerDashboardType } from '#shared/types/dashboard'

defineProps<{ buyer: BuyerDashboardType }>()

const { t, locale } = useI18n()
</script>

<template>
  <section class="mb-10" data-testid="buyer-summary">
    <div class="mb-4 flex items-center justify-between gap-4">
      <h2 class="text-xl font-medium">{{ t('dashboard.buyer.title') }}</h2>
      <Link
        route="rfqs.index"
        :params="{ locale }"
        class="text-sm font-medium text-[var(--color-primary)] hover:underline"
      >
        {{ t('dashboard.buyer.viewAll') }}
      </Link>
    </div>

    <dl class="grid grid-cols-1 gap-4 sm:grid-cols-4">
      <BaseStat
        v-for="status in RFQ_STATUSES"
        :key="status"
        :label="t(`dashboard.buyer.status.${status}`)"
        :value="buyer.rfqCounts[status]"
      />
    </dl>

    <h3 class="mt-6 mb-3 text-base font-medium">{{ t('dashboard.buyer.recent.title') }}</h3>
    <p v-if="buyer.recentResponses.length === 0" class="text-sm text-[var(--gray-6)]">
      {{ t('dashboard.buyer.recent.empty') }}
    </p>
    <ul v-else class="flex flex-col gap-2">
      <li
        v-for="response in buyer.recentResponses"
        :key="`${response.rfqId}-${response.supplierName}`"
      >
        <Link
          route="rfqs.show"
          :params="{ locale, id: response.rfqId }"
          class="text-sm font-medium text-[var(--color-primary)] hover:underline"
        >
          {{
            t('dashboard.buyer.recent.item', {
              supplier: response.supplierName,
              rfq: response.rfqTitle,
            })
          }}
        </Link>
      </li>
    </ul>
  </section>
</template>
