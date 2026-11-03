<script setup lang="ts">
import { reactive, watch } from 'vue'
import { useI18n } from '~/i18n'
import BaseCard from '~/components/base/base_card.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseSelect from '~/components/base/base_select.vue'
import { ORGANIZATION_TYPES } from '#shared/types/organization'
import { SUPPORTED_LOCALES } from '#shared/types/i18n'
import { SEARCH_EVENT_SOURCES } from '#shared/types/search_event'
import type { AdminDemandFilters } from '#shared/types/admin_demand'

/**
 * Filtres de l'écran : période, écran de recherche, langue, type d'organisation.
 * Émet `change` à chaque modification ; la page relance la visite Inertia.
 */
const props = defineProps<{ filters: AdminDemandFilters }>()
const emit = defineEmits<{ change: [filters: AdminDemandFilters] }>()

const { t } = useI18n()

const model = reactive<AdminDemandFilters>({ ...props.filters })

watch(model, () => emit('change', { ...model }))
</script>

<template>
  <BaseCard padding="md">
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <BaseInput
        id="demand-from"
        v-model="model.from"
        type="date"
        :label="t('admin.demand.filters.from')"
      />
      <BaseInput
        id="demand-to"
        v-model="model.to"
        type="date"
        :label="t('admin.demand.filters.to')"
      />

      <BaseSelect
        id="demand-source"
        v-model="model.source"
        :label="t('admin.demand.filters.source')"
      >
        <option :value="null">{{ t('admin.demand.filters.all') }}</option>
        <option v-for="source in SEARCH_EVENT_SOURCES" :key="source" :value="source">
          {{ t(`admin.demand.sources.${source}`) }}
        </option>
      </BaseSelect>

      <BaseSelect
        id="demand-locale"
        v-model="model.locale"
        :label="t('admin.demand.filters.locale')"
      >
        <option :value="null">{{ t('admin.demand.filters.all') }}</option>
        <option v-for="code in SUPPORTED_LOCALES" :key="code" :value="code">
          {{ code.toUpperCase() }}
        </option>
      </BaseSelect>

      <BaseSelect
        id="demand-org-type"
        v-model="model.organizationType"
        :label="t('admin.demand.filters.organizationType')"
      >
        <option :value="null">{{ t('admin.demand.filters.all') }}</option>
        <option v-for="type in ORGANIZATION_TYPES" :key="type" :value="type">
          {{ t(`admin.demand.organizationTypes.${type}`) }}
        </option>
      </BaseSelect>
    </div>
  </BaseCard>
</template>
