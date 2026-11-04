<script setup lang="ts">
import { computed } from 'vue'
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BasePageHeader from '~/components/base/base_page_header.vue'
import MarkingTechniqueForm from '~/components/catalogue/form/marking_technique_form.vue'
import type { MarkingTechniqueEditType } from '#shared/types/marking'

defineProps<{ technique: MarkingTechniqueEditType }>()

const { t, locale } = useI18n()

const indexUrl = computed(() => urlFor('admin.marking_techniques.index', { locale: locale.value }))
</script>

<template>
  <Head :title="t('markingTechniques.update.title')" />

  <div class="flex w-full flex-col gap-8">
    <BasePageHeader
      :title="t('markingTechniques.update.title')"
      :description="t('markingTechniques.update.subtitle', { slug: technique.slug })"
      :back-href="indexUrl"
      :back-label="t('markingTechniques.back')"
    />

    <MarkingTechniqueForm mode="edit" :technique="technique" />
  </div>
</template>
