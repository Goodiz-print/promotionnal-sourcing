<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseDescriptionItem from '~/components/base/base_description_item.vue'
import BaseDescriptionList from '~/components/base/base_description_list.vue'
import BaseSection from '~/components/base/base_section.vue'
import type { AdminProductDetail } from '#shared/types/admin_product'

/** Synthèse en lecture seule : slug, fournisseur (lien vers sa fiche), catégorie, états. */
const props = defineProps<{ product: AdminProductDetail }>()

const { t, locale } = useI18n()

const supplierUrl = computed(() =>
  props.product.supplierOrganizationId === null
    ? null
    : urlFor('admin.organizations.show', {
        locale: locale.value,
        id: props.product.supplierOrganizationId,
      })
)

const items = computed(() => [
  { label: t('admin.products.detail.slug'), value: props.product.slug },
  { label: t('admin.products.columns.category'), value: props.product.categoryName },
  {
    label: t('admin.products.detail.lifecycleStatus'),
    value: t(`admin.products.lifecycleStatus.${props.product.lifecycleStatus}`),
  },
  {
    label: t('admin.products.detail.moderationStatus'),
    value: t(`admin.products.moderationStatus.${props.product.moderationStatus}`),
  },
  {
    label: t('admin.products.columns.createdAt'),
    value: new Date(props.product.createdAt).toLocaleDateString(locale.value),
  },
])
</script>

<template>
  <BaseSection :title="t('admin.products.detail.overview')">
    <BaseDescriptionList :items="items">
      <BaseDescriptionItem v-if="supplierUrl" :label="t('admin.products.columns.supplier')">
        <Link :href="supplierUrl" class="font-semibold text-indigo-600 hover:underline">
          {{ product.supplierName }}
        </Link>
      </BaseDescriptionItem>
    </BaseDescriptionList>
  </BaseSection>
</template>
