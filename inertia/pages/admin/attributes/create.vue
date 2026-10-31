<script setup lang="ts">
import { computed } from 'vue'
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import AttributeForm from '~/components/attributes/form/attribute_form.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'

const { t, locale } = useI18n()

const indexUrl = computed(() => urlFor('admin.attributes.index', { locale: locale.value }))
</script>

<template>
  <Head :title="t('attributes.create.title')" />

  <div class="flex w-full flex-col gap-8">
    <BasePageHeader
      :title="t('attributes.create.title')"
      :description="t('attributes.create.subtitle')"
      :back-href="indexUrl"
      :back-label="t('attributes.back')"
    />

    <AttributeForm mode="create" />
  </div>
</template>
