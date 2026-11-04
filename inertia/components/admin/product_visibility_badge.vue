<script setup lang="ts">
import { useI18n } from '~/i18n'
import BaseBadge from '~/components/base/base_badge.vue'
import type { BadgeTone } from '~/types/ui'
import type { AdminProductVisibilityStatus } from '#shared/types/admin_product'

/** Pastille de la visibilité calculée d'un produit. */
defineProps<{ status: AdminProductVisibilityStatus }>()

const { t } = useI18n()

const TONES: Record<AdminProductVisibilityStatus, BadgeTone> = {
  published: 'success',
  unpublished: 'neutral',
  hidden: 'danger',
  archived: 'warning',
}
</script>

<template>
  <BaseBadge dot :tone="TONES[status]">{{ t(`admin.products.visibility.${status}`) }}</BaseBadge>
</template>
