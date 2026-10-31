<script setup lang="ts">
import { reactive, watch } from 'vue'
import { useI18n } from '~/i18n'
import BaseCard from '~/components/base/base_card.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseSelect from '~/components/base/base_select.vue'
import {
  ADMIN_AUDIT_ACTIONS,
  ADMIN_AUDIT_TARGET_TYPES,
  type AdminAuditFilters,
} from '#shared/types/admin_audit'

/**
 * Filtres du journal d'audit : action, type de cible, email de l'acteur, période.
 * Émet `change` à chaque modification ; la page relance la visite Inertia.
 */
const props = defineProps<{ filters: AdminAuditFilters }>()
const emit = defineEmits<{ change: [filters: AdminAuditFilters] }>()

const { t } = useI18n()

const model = reactive<AdminAuditFilters>({ ...props.filters })

watch(model, () => emit('change', { ...model }))
</script>

<template>
  <BaseCard padding="md">
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <BaseSelect id="audit-action" v-model="model.action" :label="t('admin.audit.filters.action')">
        <option :value="null">{{ t('admin.audit.filters.all') }}</option>
        <option v-for="action in ADMIN_AUDIT_ACTIONS" :key="action" :value="action">
          {{ t(`admin.audit.actions.${action}`) }}
        </option>
      </BaseSelect>

      <BaseSelect
        id="audit-target"
        v-model="model.targetType"
        :label="t('admin.audit.filters.target')"
      >
        <option :value="null">{{ t('admin.audit.filters.all') }}</option>
        <option v-for="target in ADMIN_AUDIT_TARGET_TYPES" :key="target" :value="target">
          {{ t(`admin.audit.targets.${target}`) }}
        </option>
      </BaseSelect>

      <BaseInput
        id="audit-actor"
        v-model="model.actor"
        type="search"
        :label="t('admin.audit.filters.actor')"
        :placeholder="t('admin.audit.filters.actorPlaceholder')"
      />

      <BaseInput
        id="audit-from"
        v-model="model.from"
        type="date"
        :label="t('admin.audit.filters.from')"
      />
      <BaseInput
        id="audit-to"
        v-model="model.to"
        type="date"
        :label="t('admin.audit.filters.to')"
      />
    </div>
  </BaseCard>
</template>
