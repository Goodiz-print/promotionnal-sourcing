<script setup lang="ts">
import { useI18n } from '~/i18n'
import BaseSection from '~/components/base/base_section.vue'
import BaseTable from '~/components/base/base_table.vue'
import ModerationStatusBadge from '~/components/admin/moderation_status_badge.vue'
import type { AdminProductModerationHistory } from '#shared/types/admin_product'
import { formatDateTime } from '#shared/helpers/date'

/** Décisions de modération successives (la plus récente fait foi pour le masquage). */
defineProps<{ history: AdminProductModerationHistory[] }>()

const { t, locale } = useI18n()

const formatDate = (value: string) => formatDateTime(value, locale.value)
</script>

<template>
  <BaseSection :title="t('admin.products.detail.moderationHistory')" flush>
    <p v-if="history.length === 0" class="px-6 py-4 text-body-sm text-text-secondary">
      {{ t('admin.products.detail.noModerationHistory') }}
    </p>
    <BaseTable v-else bare :caption="t('admin.products.detail.moderationHistory')">
      <template #head>
        <tr>
          <th scope="col">{{ t('admin.products.detail.moderationStatus') }}</th>
          <th scope="col">{{ t('admin.products.detail.reason') }}</th>
          <th scope="col">{{ t('admin.products.detail.decidedBy') }}</th>
          <th scope="col">{{ t('admin.products.detail.decidedAt') }}</th>
        </tr>
      </template>
      <tr v-for="entry in history" :key="entry.id">
        <td><ModerationStatusBadge :status="entry.status" /></td>
        <td class="text-text-secondary">{{ entry.reason }}</td>
        <td class="text-text-secondary">{{ entry.decidedByEmail }}</td>
        <td class="text-tabular whitespace-nowrap">{{ formatDate(entry.decidedAt) }}</td>
      </tr>
    </BaseTable>
  </BaseSection>
</template>
