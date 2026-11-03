<script setup lang="ts">
import { reactive, watch } from 'vue'
import { useI18n } from '~/i18n'
import BaseCard from '~/components/base/base_card.vue'
import BaseSelect from '~/components/base/base_select.vue'
import { MODERATION_AGE_FILTERS, type AdminModerationFilters } from '#shared/types/admin_moderation'
import { MODERATION_DECISIONS, MODERATION_TARGET_TYPES } from '#shared/types/moderation'

/**
 * Filtres de la file de modération : type d'élément, statut, ancienneté. Émet
 * `change` à chaque modification ; la page relance la visite Inertia.
 */
const props = defineProps<{ filters: AdminModerationFilters }>()
const emit = defineEmits<{ change: [filters: AdminModerationFilters] }>()

const { t } = useI18n()

const STATUSES = ['pending', ...MODERATION_DECISIONS] as const

const model = reactive<AdminModerationFilters>({ ...props.filters })

watch(model, () => emit('change', { ...model }))
</script>

<template>
  <BaseCard padding="md">
    <div class="grid gap-4 sm:grid-cols-3">
      <BaseSelect
        id="moderation-type"
        v-model="model.type"
        :label="t('admin.moderation.filters.type')"
      >
        <option :value="null">{{ t('admin.moderation.filters.all') }}</option>
        <option v-for="type in MODERATION_TARGET_TYPES" :key="type" :value="type">
          {{ t(`admin.moderation.types.${type}`) }}
        </option>
      </BaseSelect>

      <BaseSelect
        id="moderation-status"
        v-model="model.status"
        :label="t('admin.moderation.filters.status')"
      >
        <option v-for="status in STATUSES" :key="status" :value="status">
          {{ t(`admin.moderation.statuses.${status}`) }}
        </option>
      </BaseSelect>

      <BaseSelect
        id="moderation-age"
        v-model="model.minAgeDays"
        :label="t('admin.moderation.filters.age')"
      >
        <option v-for="age in MODERATION_AGE_FILTERS" :key="age" :value="age">
          {{ t(`admin.moderation.ages.${age}`) }}
        </option>
      </BaseSelect>
    </div>
  </BaseCard>
</template>
