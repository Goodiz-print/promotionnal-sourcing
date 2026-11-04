<script setup lang="ts">
import { computed } from 'vue'
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BasePageHeader from '~/components/base/base_page_header.vue'
import MarkingTechniqueForm from '~/components/catalogue/form/marking_technique_form.vue'

const { t, locale } = useI18n()

const indexUrl = computed(() => urlFor('admin.marking_techniques.index', { locale: locale.value }))
</script>

<template>
  <Head :title="t('markingTechniques.create.title')" />

  <div class="flex w-full flex-col gap-8">
    <BasePageHeader
      :title="t('markingTechniques.create.title')"
      :description="t('markingTechniques.create.subtitle')"
      :back-href="indexUrl"
      :back-label="t('markingTechniques.back')"
    />

    <MarkingTechniqueForm mode="create" />
  </div>
</template>
