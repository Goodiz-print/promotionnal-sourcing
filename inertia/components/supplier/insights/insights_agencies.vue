<script setup lang="ts">
import { Building2 } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseTable from '~/components/base/base_table.vue'
import { formatShortDate } from '#shared/helpers/date'
import {
  SUPPLIER_INSIGHTS_AGENCY_LIMIT,
  type SupplierInsightsAgencyRow,
} from '#shared/types/supplier_insights'

/**
 * Agences qui ont consulté (#239), réservé aux abonnés : la page ne monte ce
 * composant que si le serveur a envoyé la liste. Seules les consultations de
 * moins de 90 jours nomment une agence. Au plafond, une ligne le signale.
 */
defineProps<{ agencies: SupplierInsightsAgencyRow[] }>()

const { t, locale } = useI18n()
</script>

<template>
  <BaseSection
    flush
    :title="t('supplier.insights.agencies.title')"
    :description="t('supplier.insights.agencies.hint')"
  >
    <div v-if="agencies.length === 0" class="p-6">
      <BaseEmptyState
        compact
        :icon="Building2"
        :title="t('supplier.insights.agencies.emptyTitle')"
        :description="t('supplier.insights.agencies.emptyBody')"
      />
    </div>

    <BaseTable v-else bare :caption="t('supplier.insights.agencies.title')">
      <template #head>
        <tr>
          <th scope="col">{{ t('supplier.insights.agencies.columns.agency') }}</th>
          <th scope="col" class="text-right">
            {{ t('supplier.insights.agencies.columns.views') }}
          </th>
          <th scope="col" class="text-right">
            {{ t('supplier.insights.agencies.columns.products') }}
          </th>
          <th scope="col" class="text-right">
            {{ t('supplier.insights.agencies.columns.lastViewedAt') }}
          </th>
        </tr>
      </template>

      <tr v-for="(agency, index) in agencies" :key="index">
        <td class="font-semibold text-text-primary">{{ agency.name }}</td>
        <td class="text-tabular text-right">{{ agency.views }}</td>
        <td class="text-tabular text-right">{{ agency.products }}</td>
        <td class="text-tabular text-right whitespace-nowrap">
          {{ formatShortDate(agency.lastViewedAt, locale) }}
        </td>
      </tr>
    </BaseTable>

    <p
      v-if="agencies.length >= SUPPLIER_INSIGHTS_AGENCY_LIMIT"
      class="border-t border-hairline px-6 py-3 text-caption text-text-muted"
    >
      {{ t('supplier.insights.agencies.limited', { count: SUPPLIER_INSIGHTS_AGENCY_LIMIT }) }}
    </p>
  </BaseSection>
</template>
