<script setup lang="ts">
import { Download } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseSection from '~/components/base/base_section.vue'
import { BUTTON_BASE_CLASSES, BUTTON_SIZE_CLASSES, BUTTON_VARIANT_CLASSES } from '~/types/ui'

/** Preuve de consentement d'une organisation : consultation filtrée et export CSV (droit `audit.view`). */
const props = defineProps<{ organizationId: number; organizationName: string }>()

const { t, locale } = useI18n()

const classes = [BUTTON_BASE_CLASSES, BUTTON_VARIANT_CLASSES.secondary, BUTTON_SIZE_CLASSES.md]
const listHref = () =>
  `${urlFor('admin.consents.index', { locale: locale.value })}?organization=${encodeURIComponent(props.organizationName)}`
const exportHref = () =>
  `${urlFor('admin.consents.export', { locale: locale.value })}?organizationId=${props.organizationId}`
</script>

<template>
  <BaseSection :title="t('admin.consents.title')" :description="t('admin.consents.section')">
    <div class="flex flex-wrap gap-3">
      <a :href="listHref()" :class="classes">{{ t('admin.consents.viewList') }}</a>
      <a :href="exportHref()" :class="classes">
        <Download :size="16" aria-hidden="true" />
        {{ t('admin.consents.export') }}
      </a>
    </div>
  </BaseSection>
</template>
