<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import AuthLayout from '~/layouts/auth.vue'

defineOptions({ layout: AuthLayout })

const { t } = useI18n()
</script>

<template>
  <Head :title="t('organization.invitations.invalid.title')" />

  <div class="flex flex-col gap-8">
    <div class="flex flex-col gap-2">
      <h1 class="text-display-md">
        {{ t('organization.invitations.invalid.title') }}
      </h1>
      <p class="text-body-md text-text-secondary">
        {{ t('organization.invitations.invalid.description') }}
      </p>
    </div>
  </div>
</template>
