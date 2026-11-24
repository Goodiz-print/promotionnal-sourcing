<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3'
import { Eye, FileText, Package, Store } from 'lucide-vue-next'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseSelect from '~/components/base/base_select.vue'
import BaseStat from '~/components/base/base_stat.vue'
import InsightsAgencies from '~/components/supplier/insights/insights_agencies.vue'
import InsightsProductsTable from '~/components/supplier/insights/insights_products_table.vue'
import SubscriptionUpsell from '~/components/subscription/subscription_upsell.vue'
import {
  SUPPLIER_INSIGHTS_PERIODS,
  type SupplierInsightsPageProps,
  type SupplierInsightsPeriod,
} from '#shared/types/supplier_insights'

const props = defineProps<SupplierInsightsPageProps>()

const { t, locale } = useI18n()

function visit(period: SupplierInsightsPeriod, page = 1) {
  router.get(
    urlFor('supplier.insights.index', { locale: locale.value }),
    { period, page: page > 1 ? page : undefined },
    { preserveState: true, preserveScroll: true, only: ['period', 'report', 'upsell'] }
  )
}
</script>

<template>
  <Head :title="t('supplier.insights.title')" />

  <div class="flex w-full flex-col gap-8">
    <BasePageHeader
      :title="t('supplier.insights.title')"
      :description="t('supplier.insights.subtitle')"
    >
      <template #actions>
        <div class="w-56">
          <BaseSelect
            id="insights-period"
            :model-value="period"
            :aria-label="t('supplier.insights.period')"
            @update:model-value="(value) => visit(Number(value) as SupplierInsightsPeriod)"
          >
            <option v-for="days in SUPPLIER_INSIGHTS_PERIODS" :key="days" :value="days">
              {{ t('supplier.insights.periodOption', { days }) }}
            </option>
          </BaseSelect>
        </div>
      </template>
    </BasePageHeader>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <BaseStat
        :label="t('supplier.insights.summary.productViews')"
        :value="report.summary.productViews"
        :icon="Eye"
      />
      <BaseStat
        :label="t('supplier.insights.summary.viewedProducts')"
        :value="report.summary.viewedProducts"
        :icon="Package"
      />
      <BaseStat
        :label="t('supplier.insights.summary.supplierViews')"
        :value="report.summary.supplierViews"
        :icon="Store"
      />
      <BaseStat
        :label="t('supplier.insights.summary.rfqAdditions')"
        :value="report.summary.rfqAdditions"
        :icon="FileText"
      />
    </div>

    <InsightsAgencies v-if="report.agencies" :agencies="report.agencies" />
    <SubscriptionUpsell v-else-if="upsell" :upsell="upsell" />

    <InsightsProductsTable
      :products="report.products"
      :can-edit="canEditProducts"
      @page="(page) => visit(props.period, page)"
    />
  </div>
</template>
