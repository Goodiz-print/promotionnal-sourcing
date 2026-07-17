<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'

const { t } = useI18n()
</script>

<template>
  <Head :title="t('organization.invitations.invalid.title')" />

  <div class="mx-auto flex max-w-[480px] flex-col justify-center px-6 py-12">
    <h1 class="mb-1.25 text-[32px] tracking-[-0.5px]">
      {{ t('organization.invitations.invalid.title') }}
    </h1>
    <p class="text-lg text-[var(--gray-6)]">
      {{ t('organization.invitations.invalid.description') }}
    </p>
  </div>
</template>
