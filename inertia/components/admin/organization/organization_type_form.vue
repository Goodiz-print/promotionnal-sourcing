<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from '~/i18n'
import { useAdminOrganizationActions } from '~/composables/use_admin_organization_actions'
import BaseButton from '~/components/base/base_button.vue'
import BaseSelect from '~/components/base/base_select.vue'
import { ORGANIZATION_TYPES, type OrganizationKind } from '#shared/types/organization'

/**
 * Changement du type d'organisation (acheteur / fournisseur / les deux). Le serveur
 * refuse de retirer la capacité fournisseur si l'organisation a des produits.
 */
const props = defineProps<{ organizationId: number; organizationType: OrganizationKind }>()

const { t } = useI18n()
const { processing, changeType } = useAdminOrganizationActions(props.organizationId)

const selected = ref<OrganizationKind>(props.organizationType)
watch(
  () => props.organizationType,
  (value) => (selected.value = value)
)
</script>

<template>
  <form class="flex flex-col gap-4 sm:flex-row sm:items-end" @submit.prevent="changeType(selected)">
    <div class="sm:w-72">
      <BaseSelect
        id="organization-type-change"
        v-model="selected"
        :label="t('admin.organizations.filters.type')"
      >
        <option v-for="type in ORGANIZATION_TYPES" :key="type" :value="type">
          {{ t(`admin.organizations.types.${type}`) }}
        </option>
      </BaseSelect>
    </div>
    <BaseButton type="submit" :disabled="processing || selected === organizationType">
      {{ t('admin.organizations.actions.changeType.label') }}
    </BaseButton>
  </form>
</template>
