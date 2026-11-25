<script setup lang="ts">
import { computed } from 'vue'
import { router } from '@inertiajs/vue3'
import { RotateCcw } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseButton from '~/components/base/base_button.vue'
import BaseSelect from '~/components/base/base_select.vue'
import { supplierRfqListQuery } from '#shared/helpers/supplier_rfq'
import { SUPPLIER_RFQ_STATES } from '#shared/types/rfq'
import type { SupplierRfqFiltersType } from '#shared/types/rfq'

/**
 * Filtre de « Demandes reçues » (#230) : statut lisible. Chaque choix relance
 * la visite Inertia avec le filtre en query string (URL partageable, historique
 * du navigateur) ; le filtre affiché est celui du serveur.
 */
const props = defineProps<{ filters: SupplierRfqFiltersType }>()

const { t, locale } = useI18n()

function visit(filters: SupplierRfqFiltersType) {
  router.get(
    urlFor('supplier.rfqs.index', { locale: locale.value }),
    supplierRfqListQuery(filters),
    { preserveState: true, preserveScroll: true, replace: true }
  )
}

const status = computed({
  get: () => props.filters.status,
  set: (value) => visit({ ...props.filters, status: value }),
})
</script>

<template>
  <div
    role="search"
    :aria-label="t('rfq.supplier.index.filters.label')"
    class="flex flex-col gap-4 sm:flex-row sm:items-end"
  >
    <div class="sm:w-64">
      <BaseSelect
        id="supplier-rfq-filter-status"
        v-model="status"
        :label="t('rfq.supplier.index.filters.status')"
      >
        <option :value="null">{{ t('rfq.supplier.index.filters.allStatuses') }}</option>
        <option v-for="state in SUPPLIER_RFQ_STATES" :key="state" :value="state">
          {{ t(`rfq.supplier.state.${state}`) }}
        </option>
      </BaseSelect>
    </div>
    <BaseButton v-if="filters.status" variant="ghost" size="sm" @click="visit({ status: null })">
      <RotateCcw :size="16" aria-hidden="true" />
      {{ t('rfq.supplier.index.filters.reset') }}
    </BaseButton>
  </div>
</template>
