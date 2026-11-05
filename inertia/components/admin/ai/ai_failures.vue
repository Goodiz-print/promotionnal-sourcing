<script setup lang="ts">
import { useI18n } from '~/i18n'
import { useTradeFormat } from '~/composables/use_trade_format'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseTable from '~/components/base/base_table.vue'
import type { AdminAiFailure } from '#shared/types/admin_ai'

/** Derniers appels en échec ou tronqués, avec le motif renvoyé par le fournisseur. */
defineProps<{ rows: AdminAiFailure[] }>()

const { t } = useI18n()
const { dateTime } = useTradeFormat()
</script>

<template>
  <BaseSection
    :title="t('admin.ai.failures.title')"
    :description="t('admin.ai.failures.hint')"
    flush
  >
    <BaseEmptyState v-if="rows.length === 0" :title="t('admin.ai.failures.empty')" />

    <BaseTable v-else :caption="t('admin.ai.failures.title')">
      <template #head>
        <tr>
          <th scope="col">{{ t('admin.ai.columns.date') }}</th>
          <th scope="col">{{ t('admin.ai.columns.entity') }}</th>
          <th scope="col">{{ t('admin.ai.columns.status') }}</th>
          <th scope="col">{{ t('admin.ai.columns.error') }}</th>
        </tr>
      </template>

      <tr v-for="row in rows" :key="row.id">
        <td class="whitespace-nowrap">{{ dateTime(row.createdAt) }}</td>
        <td class="whitespace-nowrap">
          <template v-if="row.entity">
            {{ t(`admin.ai.entities.${row.entity}`) }} #{{ row.entityId }}
          </template>
        </td>
        <td>
          <BaseBadge :tone="row.status === 'failed' ? 'danger' : 'warning'">
            {{ t(`admin.ai.statuses.${row.status}`) }}
          </BaseBadge>
        </td>
        <td class="break-words text-text-secondary">{{ row.error }}</td>
      </tr>
    </BaseTable>
  </BaseSection>
</template>
