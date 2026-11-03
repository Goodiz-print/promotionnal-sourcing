<script setup lang="ts">
import { reactive, watch } from 'vue'
import { useI18n } from '~/i18n'
import { languageName } from '~/composables/use_search_insights'
import BaseCard from '~/components/base/base_card.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseSelect from '~/components/base/base_select.vue'
import { SUPPORTED_LOCALES } from '#shared/types/i18n'
import { ORGANIZATION_TYPES } from '#shared/types/organization'
import { SEARCH_EVENT_SOURCES } from '#shared/types/search_event'
import type { SearchInsightsFilters } from '#shared/types/search_insights'

/**
 * Filtres de l'écran « Ce que cherchent les clients » : période, source, langue
 * et type d'organisation. Émet `change` à chaque modification ; la page relance
 * la visite Inertia.
 */
const props = defineProps<{ filters: SearchInsightsFilters }>()
const emit = defineEmits<{ change: [filters: SearchInsightsFilters] }>()

const { t } = useI18n()

const model = reactive<SearchInsightsFilters>({ ...props.filters })

watch(model, () => emit('change', { ...model }))
</script>

<template>
  <BaseCard padding="md">
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <BaseInput
        id="search-from"
        v-model="model.from"
        type="date"
        :label="t('admin.search.filters.from')"
      />
      <BaseInput
        id="search-to"
        v-model="model.to"
        type="date"
        :label="t('admin.search.filters.to')"
      />

      <BaseSelect
        id="search-source"
        v-model="model.source"
        :label="t('admin.search.filters.source')"
      >
        <option :value="null">{{ t('admin.search.filters.all') }}</option>
        <option v-for="source in SEARCH_EVENT_SOURCES" :key="source" :value="source">
          {{ t(`admin.search.sources.${source}`) }}
        </option>
      </BaseSelect>

      <BaseSelect
        id="search-locale"
        v-model="model.locale"
        :label="t('admin.search.filters.locale')"
      >
        <option :value="null">{{ t('admin.search.filters.all') }}</option>
        <option v-for="code in SUPPORTED_LOCALES" :key="code" :value="code">
          {{ languageName(code) }}
        </option>
      </BaseSelect>

      <BaseSelect
        id="search-organization-type"
        v-model="model.organizationType"
        :label="t('admin.search.filters.organizationType')"
      >
        <option :value="null">{{ t('admin.search.filters.all') }}</option>
        <option v-for="kind in ORGANIZATION_TYPES" :key="kind" :value="kind">
          {{ t(`admin.search.organizationTypes.${kind}`) }}
        </option>
      </BaseSelect>
    </div>
  </BaseCard>
</template>
