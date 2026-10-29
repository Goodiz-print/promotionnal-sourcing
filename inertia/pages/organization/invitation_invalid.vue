<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import AuthHeader from '~/components/auth/auth_header.vue'
import AuthLayout from '~/layouts/auth.vue'

defineOptions({ layout: AuthLayout })

const { t } = useI18n()
</script>

<template>
  <Head :title="t('organization.invitations.invalid.title')" />

  <div class="flex flex-col gap-8">
    <AuthHeader
      :title="t('organization.invitations.invalid.title')"
      :description="t('organization.invitations.invalid.description')"
    />
  </div>
</template>
