<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { SearchX } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseEmptyState from '~/components/base/base_empty_state.vue'
import BaseLinkButton from '~/components/base/base_link_button.vue'

const { t, locale } = useI18n()
</script>

<template>
  <Head :title="t('errors.notFound.title')" />
  <div class="flex flex-1 items-center justify-center">
    <BaseEmptyState
      class="w-full max-w-[560px]"
      :title="t('errors.notFound.title')"
      :description="t('errors.notFound.description')"
      :icon="SearchX"
    >
      <template #actions>
        <BaseLinkButton :href="urlFor('home', { locale })">{{
          t('errors.backHome')
        }}</BaseLinkButton>
      </template>
    </BaseEmptyState>
  </div>
</template>
