<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '~/i18n'
import { useTradeFormat } from '~/composables/use_trade_format'
import BaseAlert from '~/components/base/base_alert.vue'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseTable from '~/components/base/base_table.vue'
import type { AdminSearchStatus } from '#shared/types/admin_search'

/**
 * État du moteur de recherche : alerte (inerte ou injoignable), chiffres de
 * l'index actif et dernières tâches Meilisearch.
 */
const props = defineProps<{ status: AdminSearchStatus }>()

const { t } = useI18n()
const { dateTime } = useTradeFormat()

const figures = computed(() => {
  const { info, embedder } = props.status
  return [
    { key: 'index', value: props.status.index },
    {
      key: 'documents',
      value: info?.indexExists ? String(info.documents) : t('admin.search.status.noIndex'),
    },
    {
      key: 'indexing',
      value: info ? t(info.indexing ? 'admin.search.status.yes' : 'admin.search.status.no') : '—',
    },
    {
      key: 'embedder',
      value: embedder.enabled
        ? `${embedder.provider} · ${embedder.model}`
        : t('admin.search.status.embedderOff'),
    },
    { key: 'semanticRatio', value: String(props.status.semanticRatio) },
  ]
})

const TASK_TONES: Record<string, 'success' | 'danger'> = { succeeded: 'success', failed: 'danger' }
const taskTone = (status: string) => TASK_TONES[status] ?? 'neutral'
</script>

<template>
  <BaseSection :title="t('admin.search.status.title')">
    <div class="flex flex-col gap-4">
      <BaseAlert v-if="status.state === 'disabled'" tone="warning">
        {{ t('admin.search.status.disabled') }}
      </BaseAlert>
      <BaseAlert v-else-if="status.state === 'unreachable'" tone="danger">
        {{ t('admin.search.status.unreachable') }}
        <span v-if="status.error" class="block text-caption">{{ status.error }}</span>
      </BaseAlert>
      <BaseAlert v-else-if="!status.info?.indexExists" tone="warning">
        {{ t('admin.search.status.missingIndex') }}
      </BaseAlert>
      <BaseAlert v-else tone="success">{{ t('admin.search.status.ok') }}</BaseAlert>

      <dl class="grid gap-4 text-body-sm sm:grid-cols-2 lg:grid-cols-5">
        <div v-for="figure in figures" :key="figure.key">
          <dt class="text-text-secondary">{{ t(`admin.search.status.${figure.key}`) }}</dt>
          <dd class="text-tabular font-semibold text-text-primary">{{ figure.value }}</dd>
        </div>
      </dl>

      <div v-if="status.info && status.info.tasks.length > 0" class="flex flex-col gap-2">
        <h3 class="text-heading-sm text-text-primary">{{ t('admin.search.tasks.title') }}</h3>
        <BaseTable :caption="t('admin.search.tasks.title')">
          <template #head>
            <tr>
              <th scope="col">{{ t('admin.search.tasks.uid') }}</th>
              <th scope="col">{{ t('admin.search.tasks.type') }}</th>
              <th scope="col">{{ t('admin.search.tasks.status') }}</th>
              <th scope="col">{{ t('admin.search.tasks.date') }}</th>
              <th scope="col">{{ t('admin.search.tasks.error') }}</th>
            </tr>
          </template>
          <tr v-for="task in status.info.tasks" :key="task.uid">
            <td class="text-tabular">{{ task.uid }}</td>
            <td>{{ task.type }}</td>
            <td>
              <BaseBadge :tone="taskTone(task.status)">{{ task.status }}</BaseBadge>
            </td>
            <td>{{ dateTime(task.finishedAt ?? task.enqueuedAt) }}</td>
            <td class="max-w-xs truncate">{{ task.error ?? '—' }}</td>
          </tr>
        </BaseTable>
      </div>
    </div>
  </BaseSection>
</template>
