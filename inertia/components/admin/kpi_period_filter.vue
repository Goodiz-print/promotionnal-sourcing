<script setup lang="ts">
import { reactive, watch } from 'vue'
import { useI18n } from '~/i18n'
import BaseCard from '~/components/base/base_card.vue'
import BaseInput from '~/components/base/base_input.vue'
import type { AdminKpiFilters } from '#shared/types/admin_kpi'

/**
 * Sélecteur de période du tableau de bord KPI. Émet `change` quand les deux dates
 * sont renseignées ; la page relance la visite Inertia.
 */
const props = defineProps<{ filters: AdminKpiFilters }>()
const emit = defineEmits<{ change: [filters: AdminKpiFilters] }>()

const { t } = useI18n()

const model = reactive<AdminKpiFilters>({ ...props.filters })

watch(model, () => {
  if (model.from && model.to) emit('change', { ...model })
})
</script>

<template>
  <BaseCard padding="md">
    <div class="grid gap-4 sm:grid-cols-2 lg:max-w-xl">
      <BaseInput
        id="kpi-from"
        v-model="model.from"
        type="date"
        :label="t('admin.dashboard.kpi.filters.from')"
      />
      <BaseInput
        id="kpi-to"
        v-model="model.to"
        type="date"
        :label="t('admin.dashboard.kpi.filters.to')"
      />
    </div>
    <p class="mt-3 text-caption text-text-muted">{{ t('admin.dashboard.kpi.filters.hint') }}</p>
  </BaseCard>
</template>
