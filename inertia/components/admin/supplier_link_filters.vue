<script setup lang="ts">
import { reactive, watch } from 'vue'
import { useI18n } from '~/i18n'
import BaseCard from '~/components/base/base_card.vue'
import BaseSelect from '~/components/base/base_select.vue'
import { SUPPLIER_LINK_FILTERS, type AdminSupplierLinkFilters } from '#shared/types/supplier_link'

/**
 * Filtre de l'écran de rattachement : fiches en attente d'accord ou
 * rattachées. Émet `change` à chaque modification ; la page relance la visite.
 */
const props = defineProps<{ filters: AdminSupplierLinkFilters }>()
const emit = defineEmits<{ change: [filters: AdminSupplierLinkFilters] }>()

const { t } = useI18n()

const model = reactive<AdminSupplierLinkFilters>({ ...props.filters })

watch(model, () => emit('change', { ...model }))
</script>

<template>
  <BaseCard padding="md">
    <div class="grid gap-4 sm:max-w-xs">
      <BaseSelect
        id="supplier-link-status"
        v-model="model.status"
        :label="t('admin.supplierLinks.filters.status')"
      >
        <option v-for="status in SUPPLIER_LINK_FILTERS" :key="status" :value="status">
          {{ t(`admin.supplierLinks.filters.${status}`) }}
        </option>
      </BaseSelect>
    </div>
  </BaseCard>
</template>
