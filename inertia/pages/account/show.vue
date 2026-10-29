<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import BasePageHeader from '~/components/base/base_page_header.vue'
import ProfileForm from '~/components/account/profile_form.vue'
import PasswordForm from '~/components/account/password_form.vue'
import PasskeysSection from '~/components/account/passkeys_section.vue'
import DangerZone from '~/components/account/danger_zone.vue'
import type { AccountType } from '#shared/types/account'
import type { PasskeyType } from '#shared/types/passkey'

defineProps<{
  account: AccountType
  blockingOrganizations: string[]
  passkeys: PasskeyType[]
}>()

const { t } = useI18n()
</script>

<template>
  <Head :title="t('account.title')" />

  <div class="flex w-full flex-col gap-8">
    <BasePageHeader :title="t('account.title')" :description="t('account.subtitle')" />

    <ProfileForm :account="account" />
    <PasswordForm />
    <PasskeysSection :passkeys="passkeys" />
    <DangerZone :blocking-organizations="blockingOrganizations" />
  </div>
</template>
