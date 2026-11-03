<script setup lang="ts">
import { reactive, watch } from 'vue'
import { useI18n } from '~/i18n'
import BaseCard from '~/components/base/base_card.vue'
import BaseSelect from '~/components/base/base_select.vue'
import { AGENCY_REVIEW_FILTERS, type AdminAgencyReviewFilters } from '#shared/types/agency_review'

/**
 * Filtre de la file de revue des agences : à revoir, approuvées, rejetées. Émet
 * `change` à chaque modification ; la page relance la visite Inertia.
 */
const props = defineProps<{ filters: AdminAgencyReviewFilters }>()
const emit = defineEmits<{ change: [filters: AdminAgencyReviewFilters] }>()

const { t } = useI18n()

const model = reactive<AdminAgencyReviewFilters>({ ...props.filters })

watch(model, () => emit('change', { ...model }))
</script>

<template>
  <BaseCard padding="md">
    <div class="grid gap-4 sm:max-w-xs">
      <BaseSelect
        id="agency-review-status"
        v-model="model.status"
        :label="t('admin.agencyReviews.filters.status')"
      >
        <option v-for="status in AGENCY_REVIEW_FILTERS" :key="status" :value="status">
          {{ t(`admin.agencyReviews.filters.${status}`) }}
        </option>
      </BaseSelect>
    </div>
  </BaseCard>
</template>
