<script setup lang="ts">
import { reactive, watch } from 'vue'
import { Search } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import BaseButton from '~/components/base/base_button.vue'
import BaseCard from '~/components/base/base_card.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseSelect from '~/components/base/base_select.vue'
import type { AdminUserFilterOptions, AdminUserIndexFilters } from '#shared/types/admin_user'

/**
 * Filtres de la liste des utilisateurs : email, rôle plateforme, vérification,
 * activité, type d'organisation et statut. Les champs sont envoyés à la validation
 * du formulaire via `change` ; la page relance la visite Inertia.
 */
const props = defineProps<{
  filters: AdminUserIndexFilters
  options: AdminUserFilterOptions
}>()
const emit = defineEmits<{ change: [filters: AdminUserIndexFilters] }>()

const { t } = useI18n()

const fromProps = () => ({
  search: props.filters.search ?? '',
  platformRole: props.filters.platformRole ?? '',
  emailVerified: props.filters.emailVerified ?? '',
  activity: props.filters.activity ?? '',
  organizationType: props.filters.organizationType ?? '',
  status: props.filters.status ?? '',
})

const model = reactive(fromProps())

// Les filtres du serveur font foi : retour arrière, lien externe ou pagination
// les changent sans passer par le formulaire.
watch(
  () => props.filters,
  () => Object.assign(model, fromProps()),
  { deep: true }
)

function submit() {
  emit('change', {
    search: model.search.trim() || null,
    platformRole: (model.platformRole || null) as AdminUserIndexFilters['platformRole'],
    emailVerified: (model.emailVerified || null) as AdminUserIndexFilters['emailVerified'],
    activity: (model.activity || null) as AdminUserIndexFilters['activity'],
    organizationType: (model.organizationType || null) as AdminUserIndexFilters['organizationType'],
    status: (model.status || null) as AdminUserIndexFilters['status'],
  })
}

function reset() {
  Object.assign(model, {
    search: '',
    platformRole: '',
    emailVerified: '',
    activity: '',
    organizationType: '',
    status: '',
  })
  submit()
}
</script>

<template>
  <BaseCard padding="md">
    <form class="flex flex-col gap-4" @submit.prevent="submit">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <BaseInput
          id="user-search"
          v-model="model.search"
          type="search"
          :label="t('admin.users.searchLabel')"
          :placeholder="t('admin.users.searchPlaceholder')"
        >
          <template #prefix><Search :size="16" aria-hidden="true" /></template>
        </BaseInput>
        <BaseSelect
          id="user-platform-role"
          v-model="model.platformRole"
          :label="t('admin.users.filters.platformRole')"
        >
          <option value="">{{ t('admin.users.filters.all') }}</option>
          <option v-for="role in options.platformRoles" :key="role" :value="role">
            {{
              role === 'any-role'
                ? t('admin.users.filters.anyRole')
                : t(`admin.users.roles.${role}`)
            }}
          </option>
        </BaseSelect>
        <BaseSelect
          id="user-email-verified"
          v-model="model.emailVerified"
          :label="t('admin.users.filters.emailVerified')"
        >
          <option value="">{{ t('admin.users.filters.all') }}</option>
          <option value="verified">{{ t('admin.users.filters.verified') }}</option>
          <option value="unverified">{{ t('admin.users.filters.unverified') }}</option>
        </BaseSelect>
        <BaseSelect
          id="user-activity"
          v-model="model.activity"
          :label="t('admin.users.filters.activity')"
        >
          <option value="">{{ t('admin.users.filters.all') }}</option>
          <option value="recent">{{ t('admin.users.filters.recent') }}</option>
          <option value="never">{{ t('admin.users.filters.never') }}</option>
        </BaseSelect>
        <BaseSelect
          id="user-organization-type"
          v-model="model.organizationType"
          :label="t('admin.users.filters.organizationType')"
        >
          <option value="">{{ t('admin.users.filters.all') }}</option>
          <option v-for="type in options.organizationTypes" :key="type" :value="type">
            {{ t(`admin.organizations.types.${type}`) }}
          </option>
        </BaseSelect>
        <BaseSelect
          id="user-status"
          v-model="model.status"
          :label="t('admin.users.filters.status')"
        >
          <option value="">{{ t('admin.users.filters.all') }}</option>
          <option value="active">{{ t('admin.users.filters.active') }}</option>
          <option value="suspended">{{ t('admin.users.filters.suspended') }}</option>
        </BaseSelect>
      </div>
      <div class="flex justify-end gap-3">
        <BaseButton variant="secondary" size="sm" @click="reset">
          {{ t('admin.trade.filters.reset') }}
        </BaseButton>
        <BaseButton type="submit" size="sm">{{ t('admin.trade.filters.apply') }}</BaseButton>
      </div>
    </form>
  </BaseCard>
</template>
