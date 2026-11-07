<script setup lang="ts">
import { useI18n } from '~/i18n'
import BaseSection from '~/components/base/base_section.vue'
import BaseTable from '~/components/base/base_table.vue'
import { formatFileSize } from '#shared/helpers/file_size'
import type { AdminStorageOverview } from '#shared/types/admin_ops'

/** Volume `ready` rattaché à chaque organisation (les plus volumineuses d'abord). */
defineProps<{ overview: AdminStorageOverview }>()

const { t } = useI18n()
</script>

<template>
  <BaseSection
    :title="t('admin.storage.organizations.title')"
    :description="t('admin.storage.organizations.description')"
    flush
  >
    <p
      v-if="overview.organizations.length === 0"
      class="px-6 py-4 text-body-sm text-text-secondary"
    >
      {{ t('admin.storage.organizations.empty') }}
    </p>
    <BaseTable v-else :caption="t('admin.storage.organizations.title')">
      <template #head>
        <tr>
          <th scope="col">{{ t('admin.storage.columns.organization') }}</th>
          <th scope="col">{{ t('admin.storage.columns.objects') }}</th>
          <th scope="col">{{ t('admin.storage.columns.size') }}</th>
        </tr>
      </template>
      <tr v-for="row in overview.organizations" :key="row.organizationId">
        <td class="font-semibold text-text-primary">{{ row.name }}</td>
        <td class="text-tabular">{{ row.count }}</td>
        <td class="text-tabular">{{ formatFileSize(row.bytes) }}</td>
      </tr>
    </BaseTable>
    <p class="px-6 py-3 text-caption text-text-muted">
      {{
        t('admin.storage.organizations.unattributed', {
          size: formatFileSize(overview.unattributedBytes),
        })
      }}
    </p>
  </BaseSection>
</template>
