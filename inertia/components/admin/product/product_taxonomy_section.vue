<script setup lang="ts">
import { useI18n } from '~/i18n'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseSection from '~/components/base/base_section.vue'
import type { AdminProductAttribute, AdminProductCertification } from '#shared/types/admin_product'

/** Certifications et attributs du produit, en lecture seule. */
defineProps<{
  certifications: AdminProductCertification[]
  attributes: AdminProductAttribute[]
}>()

const { t } = useI18n()
</script>

<template>
  <div class="grid gap-8 lg:grid-cols-2">
    <BaseSection :title="t('admin.products.detail.certifications')">
      <p v-if="certifications.length === 0" class="text-body-sm text-text-secondary">
        {{ t('admin.products.detail.noCertifications') }}
      </p>
      <ul v-else class="flex flex-wrap gap-2">
        <li v-for="certification in certifications" :key="certification.id">
          <BaseBadge tone="info">{{ certification.name ?? certification.slug }}</BaseBadge>
        </li>
      </ul>
    </BaseSection>

    <BaseSection :title="t('admin.products.detail.attributes')">
      <p v-if="attributes.length === 0" class="text-body-sm text-text-secondary">
        {{ t('admin.products.detail.noAttributes') }}
      </p>
      <ul v-else class="flex flex-col gap-2 text-body-sm">
        <li
          v-for="attribute in attributes"
          :key="`${attribute.attributeSlug}-${attribute.label}`"
          class="flex justify-between gap-4"
        >
          <span class="text-text-secondary">
            {{ attribute.attributeName ?? attribute.attributeSlug }}
          </span>
          <span class="font-semibold text-text-primary">{{ attribute.label }}</span>
        </li>
      </ul>
    </BaseSection>
  </div>
</template>
