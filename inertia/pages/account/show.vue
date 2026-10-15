<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import ProfileForm from '~/components/account/profile_form.vue'
import PasswordForm from '~/components/account/password_form.vue'
import DangerZone from '~/components/account/danger_zone.vue'
import type { AccountType } from '#shared/types/account'

defineProps<{ account: AccountType; blockingOrganizations: string[] }>()

const { t } = useI18n()
</script>

<template>
  <Head :title="t('account.title')" />

  <div class="mx-auto flex max-w-[720px] flex-col gap-12 px-6 py-12">
    <div>
      <h1 class="mb-1.25 text-[32px] tracking-[-0.5px]">{{ t('account.title') }}</h1>
      <p class="text-lg text-[var(--gray-6)]">{{ t('account.subtitle') }}</p>
    </div>

    <ProfileForm :account="account" />
    <PasswordForm />
    <DangerZone :blocking-organizations="blockingOrganizations" />
  </div>
</template>
