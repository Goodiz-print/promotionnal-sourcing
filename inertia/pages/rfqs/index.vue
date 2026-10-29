<script setup lang="ts">
import { computed } from 'vue'
import { Head } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { FileText, Plus } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BaseLinkButton from '~/components/base/base_link_button.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseTable from '~/components/base/base_table.vue'
import { RFQ_STATUS_TONES } from '~/components/rfqs/types'
import type { RfqType } from '#shared/types/rfq'

defineProps<{ rfqs: RfqType[]; canManageRfq: boolean }>()

const { t, locale } = useI18n()

const createUrl = computed(() => urlFor('rfqs.create', { locale: locale.value }))

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(locale.value)
}
</script>

<template>
  <Head :title="t('rfq.index.title')" />

  <div class="flex flex-col gap-8">
    <BasePageHeader :title="t('rfq.index.title')" :description="t('rfq.index.subtitle')">
      <!-- Une seule action primaire par écran : l'état vide porte la sienne. -->
      <template v-if="rfqs.length > 0" #actions>
        <BaseLinkButton :href="createUrl">
          <Plus :size="18" aria-hidden="true" />
          {{ t('rfq.index.new') }}
        </BaseLinkButton>
      </template>
    </BasePageHeader>

    <BaseEmptyState
      v-if="rfqs.length === 0"
      :title="t('rfq.index.empty')"
      :description="t('rfq.index.emptyDescription')"
      :icon="FileText"
    >
      <template #actions>
        <BaseLinkButton :href="createUrl">
          <Plus :size="18" aria-hidden="true" />
          {{ t('rfq.index.new') }}
        </BaseLinkButton>
      </template>
    </BaseEmptyState>

    <BaseTable v-else :caption="t('rfq.index.title')">
      <template #head>
        <tr>
          <th scope="col">{{ t('rfq.index.columns.title') }}</th>
          <th scope="col" class="text-right">{{ t('rfq.index.columns.items') }}</th>
          <th scope="col" class="text-right">{{ t('rfq.index.columns.suppliers') }}</th>
          <th scope="col" class="text-right">{{ t('rfq.index.columns.responses') }}</th>
          <th scope="col">{{ t('rfq.index.columns.status') }}</th>
          <th scope="col">{{ t('rfq.index.columns.deadline') }}</th>
        </tr>
      </template>

      <tr v-for="rfq in rfqs" :key="rfq.id">
        <td>
          <Link
            route="rfqs.show"
            :params="{ locale, id: rfq.id }"
            class="font-semibold text-text-primary hover:text-indigo-600"
          >
            {{ rfq.title }}
          </Link>
        </td>
        <td class="text-tabular text-right">{{ rfq.itemCount }}</td>
        <td class="text-tabular text-right">{{ rfq.supplierCount }}</td>
        <td class="text-tabular text-right">
          {{
            t('rfq.index.responses', { responded: rfq.respondedCount, total: rfq.supplierCount })
          }}
        </td>
        <td>
          <BaseBadge dot :tone="RFQ_STATUS_TONES[rfq.status]">
            {{ t(`rfq.status.${rfq.status}`) }}
          </BaseBadge>
        </td>
        <td class="text-tabular whitespace-nowrap">
          <template v-if="rfq.deadline">{{ formatDate(rfq.deadline) }}</template>
          <span v-else class="text-text-muted">{{ t('rfq.show.noDeadline') }}</span>
        </td>
      </tr>
    </BaseTable>
  </div>
</template>
