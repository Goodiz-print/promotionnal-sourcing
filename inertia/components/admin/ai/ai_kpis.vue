<script setup lang="ts">
import { computed } from 'vue'
import { Coins, Cpu, Sparkles, TriangleAlert } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import BaseStat from '~/components/base/base_stat.vue'
import { formatMoney } from '~/components/quotes/types'
import type { AdminAiOverview } from '#shared/types/admin_ai'

/** Compteurs de la fenêtre : appels, échecs, tokens et coût estimé. */
const props = defineProps<{ overview: AdminAiOverview }>()

const { t, locale } = useI18n()

const number = (value: number) => value.toLocaleString(locale.value)

const cost = computed(() => {
  const { pricing, totals } = props.overview
  if (!pricing || totals.estimatedCost === null) return t('admin.ai.cost.unknown')
  return formatMoney(totals.estimatedCost, pricing.currency, locale.value)
})
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <BaseStat
      :label="t('admin.ai.kpis.calls')"
      :value="number(overview.totals.calls)"
      :hint="t('admin.ai.kpis.window', { days: overview.days })"
      :icon="Sparkles"
    />
    <BaseStat
      :label="t('admin.ai.kpis.failed')"
      :value="number(overview.totals.failed)"
      :hint="t('admin.ai.kpis.truncated', { count: overview.totals.truncated })"
      :icon="TriangleAlert"
    />
    <BaseStat
      :label="t('admin.ai.kpis.tokens')"
      :value="number(overview.totals.promptTokens + overview.totals.completionTokens)"
      :hint="
        t('admin.ai.kpis.tokensDetail', {
          input: number(overview.totals.promptTokens),
          output: number(overview.totals.completionTokens),
        })
      "
      :icon="Cpu"
    />
    <BaseStat
      :label="t('admin.ai.kpis.cost')"
      :value="cost"
      :hint="overview.pricing ? t('admin.ai.cost.estimate') : t('admin.ai.cost.configure')"
      :icon="Coins"
    />
  </div>
</template>
