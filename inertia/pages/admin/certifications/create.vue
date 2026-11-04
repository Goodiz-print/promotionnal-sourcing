<script setup lang="ts">
import { computed } from 'vue'
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BasePageHeader from '~/components/base/base_page_header.vue'
import CertificationForm from '~/components/catalogue/form/certification_form.vue'

const { t, locale } = useI18n()

const indexUrl = computed(() => urlFor('admin.certifications.index', { locale: locale.value }))
</script>

<template>
  <Head :title="t('certifications.create.title')" />

  <div class="flex w-full flex-col gap-8">
    <BasePageHeader
      :title="t('certifications.create.title')"
      :description="t('certifications.create.subtitle')"
      :back-href="indexUrl"
      :back-label="t('certifications.back')"
    />

    <CertificationForm mode="create" />
  </div>
</template>
