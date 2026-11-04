<script setup lang="ts">
import { reactive, watch } from 'vue'
import { Search } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import BaseButton from '~/components/base/base_button.vue'
import BaseCard from '~/components/base/base_card.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseSelect from '~/components/base/base_select.vue'
import type {
  AdminOrganizationFilterOptions,
  AdminOrganizationIndexFilters,
} from '#shared/types/admin_organization'

/**
 * Filtres de la liste des organisations : recherche (nom, slug, SIRET, TVA), type,
 * statut et pays. Les champs sont envoyés au clic sur « Filtrer » via `change` ;
 * la page relance la visite Inertia.
 */
const props = defineProps<{
  filters: AdminOrganizationIndexFilters
  options: AdminOrganizationFilterOptions
}>()
const emit = defineEmits<{ change: [filters: AdminOrganizationIndexFilters] }>()

const { t } = useI18n()

const fromProps = () => ({
  search: props.filters.search ?? '',
  type: props.filters.type ?? '',
  status: props.filters.status,
  country: props.filters.country ?? '',
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
    type: (model.type || null) as AdminOrganizationIndexFilters['type'],
    status: model.status,
    country: model.country || null,
  })
}

function reset() {
  Object.assign(model, { search: '', type: '', status: 'active', country: '' })
  submit()
}
</script>

<template>
  <BaseCard padding="md">
    <form class="flex flex-col gap-4" @submit.prevent="submit">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <BaseInput
          id="organization-search"
          v-model="model.search"
          type="search"
          :label="t('admin.organizations.filters.search')"
          :placeholder="t('admin.organizations.filters.searchPlaceholder')"
        >
          <template #prefix><Search :size="16" aria-hidden="true" /></template>
        </BaseInput>
        <BaseSelect
          id="organization-type"
          v-model="model.type"
          :label="t('admin.organizations.filters.type')"
        >
          <option value="">{{ t('admin.organizations.filters.allTypes') }}</option>
          <option v-for="type in options.organizationTypes" :key="type" :value="type">
            {{ t(`admin.organizations.types.${type}`) }}
          </option>
        </BaseSelect>
        <BaseSelect
          id="organization-status"
          v-model="model.status"
          :label="t('admin.organizations.filters.status')"
        >
          <option value="active">{{ t('admin.organizations.status.active') }}</option>
          <option value="archived">{{ t('admin.organizations.status.archived') }}</option>
          <option value="all">{{ t('admin.organizations.status.all') }}</option>
        </BaseSelect>
        <BaseSelect
          id="organization-country"
          v-model="model.country"
          :label="t('admin.organizations.filters.country')"
        >
          <option value="">{{ t('admin.organizations.filters.allCountries') }}</option>
          <option v-for="country in options.countries" :key="country" :value="country">
            {{ country }}
          </option>
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
