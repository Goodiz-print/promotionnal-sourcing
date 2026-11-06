<script setup lang="ts">
import { useI18n } from '~/i18n'
import { useTradeFormat } from '~/composables/use_trade_format'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseTable from '~/components/base/base_table.vue'
import { History } from 'lucide-vue-next'
import type { AdminSearchRun, SearchRunStatus } from '#shared/types/admin_search'

/**
 * Historique des opérations d'un type : réindexations (avancement, produits
 * indexés) ou évaluations (rappel@10, réussites, latences).
 */
defineProps<{ kind: 'reindex' | 'evaluation'; runs: AdminSearchRun[] }>()

const { t } = useI18n()
const { dateTime } = useTradeFormat()

const TONES: Record<SearchRunStatus, 'neutral' | 'info' | 'success' | 'danger'> = {
  pending: 'neutral',
  running: 'info',
  completed: 'success',
  failed: 'danger',
}
</script>

<template>
  <BaseSection :title="t(`admin.search.${kind}.history`)" flush>
    <BaseEmptyState
      v-if="runs.length === 0"
      :icon="History"
      :title="t('admin.search.runs.empty')"
      :description="t('admin.search.runs.emptyDescription')"
    />
    <BaseTable v-else bare :caption="t(`admin.search.${kind}.history`)">
      <template #head>
        <tr>
          <th scope="col">{{ t('admin.search.runs.date') }}</th>
          <th scope="col">{{ t('admin.search.runs.status') }}</th>
          <th v-if="kind === 'reindex'" scope="col">{{ t('admin.search.runs.scope') }}</th>
          <th v-if="kind === 'reindex'" scope="col">{{ t('admin.search.runs.progress') }}</th>
          <template v-else>
            <th scope="col">{{ t('admin.search.runs.recall') }}</th>
            <th scope="col">{{ t('admin.search.runs.results') }}</th>
            <th scope="col">{{ t('admin.search.runs.latency') }}</th>
          </template>
          <th scope="col">{{ t('admin.search.runs.requestedBy') }}</th>
        </tr>
      </template>
      <tr v-for="run in runs" :key="run.id">
        <td>{{ dateTime(run.createdAt) }}</td>
        <td>
          <BaseBadge :tone="TONES[run.status]">{{
            t(`admin.search.runs.statuses.${run.status}`)
          }}</BaseBadge>
          <span v-if="run.error" class="block max-w-xs truncate text-caption text-danger">
            {{ run.error }}
          </span>
        </td>
        <template v-if="kind === 'reindex'">
          <td>
            {{
              run.supplierId
                ? t('admin.search.runs.supplier', {
                    name: run.supplierName ?? '—',
                    id: run.supplierId,
                  })
                : t('admin.search.runs.all')
            }}
          </td>
          <td class="min-w-40">
            <div
              class="h-2 w-full overflow-hidden rounded-full bg-sunken"
              role="progressbar"
              :aria-valuenow="run.progress ?? 0"
              aria-valuemin="0"
              aria-valuemax="100"
              :aria-label="t('admin.search.runs.progress')"
            >
              <div class="h-full bg-indigo-600" :style="{ width: `${run.progress ?? 0}%` }" />
            </div>
            <span class="text-caption text-text-muted">
              {{
                run.status === 'completed'
                  ? t('admin.search.runs.indexed', { count: run.indexed ?? 0 })
                  : t('admin.search.runs.processed', {
                      done: run.processed,
                      total: run.total ?? '…',
                    })
              }}
            </span>
          </td>
        </template>
        <template v-else>
          <td class="text-tabular">
            {{ run.evaluation ? run.evaluation.recallAt10.toFixed(2) : '—' }}
          </td>
          <td>
            <template v-if="run.evaluation">
              {{
                t('admin.search.runs.counts', {
                  passed: run.evaluation.passed,
                  failed: run.evaluation.failed,
                  skipped: run.evaluation.skipped,
                })
              }}
              <ul v-if="run.evaluation.failures.length > 0" class="text-caption text-danger">
                <li v-for="failure in run.evaluation.failures" :key="failure.id">
                  {{ failure.id }} — {{ t('admin.search.runs.missing') }}
                  {{ failure.missing.join(', ') || '—' }}
                </li>
              </ul>
            </template>
            <template v-else>—</template>
          </td>
          <td class="text-tabular">
            <template v-if="run.evaluation">
              {{
                t('admin.search.runs.latencies', {
                  p50: Math.round(run.evaluation.latencyP50Ms),
                  p95: Math.round(run.evaluation.latencyP95Ms),
                })
              }}
            </template>
            <template v-else>—</template>
          </td>
        </template>
        <td>{{ run.requestedBy ?? '—' }}</td>
      </tr>
    </BaseTable>
  </BaseSection>
</template>
