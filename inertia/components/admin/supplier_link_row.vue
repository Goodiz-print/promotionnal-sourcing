<script setup lang="ts">
import { computed, ref } from 'vue'
import { Link2, Unlink } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { useSupplierLinkActions } from '~/composables/use_supplier_link_actions'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseButton from '~/components/base/base_button.vue'
import BaseSelect from '~/components/base/base_select.vue'
import type {
  AdminSupplierLinkItem,
  SupplierLinkOrganizationOption,
} from '#shared/types/supplier_link'

/**
 * Ligne d'une fiche fournisseur (#231). En attente : organisation proposée
 * (pré-sélectionnée) et bouton « Rattacher ». Rattachée : organisation, date et
 * auteur de l'accord, bouton « Détacher ».
 */
const props = defineProps<{
  supplier: AdminSupplierLinkItem
  organizations: SupplierLinkOrganizationOption[]
}>()

const { t, locale } = useI18n()
const { processing, link, unlink } = useSupplierLinkActions(props.supplier.id)

const selected = ref<number | null>(props.supplier.suggestion?.organizationId ?? null)
const contact = computed(() =>
  [props.supplier.email, props.supplier.website].filter(Boolean).join(' · ')
)
const formatDate = (value: string) => new Date(value).toLocaleDateString(locale.value)

function submitLink() {
  if (selected.value !== null) link(selected.value)
}

function confirmUnlink() {
  unlink({
    message: t('admin.supplierLinks.confirmUnlink', { name: props.supplier.name }),
    confirmLabel: t('admin.supplierLinks.unlink'),
    tone: 'danger',
  })
}
</script>

<template>
  <tr>
    <td class="font-semibold text-text-primary">
      {{ supplier.name }}
      <span class="block text-caption font-normal text-text-secondary">
        {{ supplier.country }}<template v-if="contact"> · {{ contact }}</template>
      </span>
    </td>
    <td class="text-tabular">{{ supplier.productsCount }}</td>

    <template v-if="supplier.organization">
      <td>{{ supplier.organization.name }}</td>
      <td class="text-body-sm text-text-secondary">
        <template v-if="supplier.linkedAt">
          {{ formatDate(supplier.linkedAt) }}
          <span v-if="supplier.linkedByEmail" class="block text-caption">
            {{ t('admin.supplierLinks.by', { email: supplier.linkedByEmail }) }}
          </span>
        </template>
        <template v-else>{{ t('admin.supplierLinks.noAgreementDate') }}</template>
      </td>
      <td class="text-right">
        <BaseButton variant="danger" size="sm" :disabled="processing" @click="confirmUnlink">
          <Unlink :size="16" aria-hidden="true" />
          {{ t('admin.supplierLinks.unlink') }}
        </BaseButton>
      </td>
    </template>

    <template v-else>
      <td>
        <BaseBadge v-if="supplier.suggestion" tone="info">
          {{
            t(`admin.supplierLinks.match.${supplier.suggestion.match}`, {
              name: supplier.suggestion.organizationName,
            })
          }}
        </BaseBadge>
        <span v-else class="text-body-sm text-text-secondary">
          {{ t('admin.supplierLinks.noSuggestion') }}
        </span>
      </td>
      <td class="min-w-56">
        <BaseSelect
          :id="`supplier-link-${supplier.id}`"
          v-model="selected"
          :aria-label="t('admin.supplierLinks.organizationLabel', { name: supplier.name })"
        >
          <option :value="null">{{ t('admin.supplierLinks.chooseOrganization') }}</option>
          <option
            v-for="organization in organizations"
            :key="organization.id"
            :value="organization.id"
          >
            {{ organization.name }}
          </option>
        </BaseSelect>
      </td>
      <td class="text-right">
        <BaseButton size="sm" :disabled="processing || selected === null" @click="submitLink">
          <Link2 :size="16" aria-hidden="true" />
          {{ t('admin.supplierLinks.link') }}
        </BaseButton>
      </td>
    </template>
  </tr>
</template>
