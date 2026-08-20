<script setup lang="ts">
import { Head, useForm } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import BaseButton from '~/components/base_button.vue'
import type { OrganizationInvitationPreviewType } from '#shared/types/organization'

const props = defineProps<{
  invitation: OrganizationInvitationPreviewType
  currentUserEmail: string | null
  acceptActionUrl: string
  loginUrl: string
  signupUrl: string
}>()

const { t } = useI18n()

const emailMatches =
  props.currentUserEmail !== null &&
  props.currentUserEmail.toLowerCase() === props.invitation.email.toLowerCase()

const form = useForm({})

function accept() {
  // Même URL (avec sa querystring signée) que celle utilisée pour charger
  // cet écran — ne jamais reconstruire via `urlFor`, qui perdrait la signature.
  form.post(props.acceptActionUrl)
}
</script>

<template>
  <Head :title="t('organization.invitations.accept.title')" />

  <div class="mx-auto flex max-w-[480px] flex-col justify-center px-6 py-12">
    <h1 class="mb-1.25 text-[32px] tracking-[-0.5px]">
      {{ t('organization.invitations.accept.title') }}
    </h1>
    <p class="mb-8 text-lg text-[var(--gray-6)]">
      {{
        t('organization.invitations.accept.description', {
          organization: invitation.organizationName,
          role: invitation.roleName,
        })
      }}
    </p>

    <BaseButton v-if="emailMatches" type="button" :disabled="form.processing" @click="accept">
      {{ t('organization.invitations.accept.submit') }}
    </BaseButton>

    <div v-else-if="currentUserEmail" class="text-sm text-[var(--gray-6)]">
      <p class="mb-3">
        {{ t('organization.invitations.accept.wrongAccount', { email: currentUserEmail }) }}
      </p>
      <Link :href="loginUrl" class="text-[var(--color-primary)] hover:underline">
        {{ t('organization.invitations.accept.loginAsInvited') }}
      </Link>
    </div>

    <div v-else class="flex gap-3">
      <Link
        :href="loginUrl"
        class="cursor-pointer rounded bg-[var(--color-primary)] p-2.5 px-4 text-center font-medium text-[var(--color-primary-contrast)] hover:bg-[var(--color-primary-hover)]"
      >
        {{ t('organization.invitations.accept.login') }}
      </Link>
      <Link
        :href="signupUrl"
        class="cursor-pointer rounded border border-[var(--gray-4)] px-4 py-2.5 text-center text-sm font-medium hover:bg-[var(--gray-2)]"
      >
        {{ t('organization.invitations.accept.signup') }}
      </Link>
    </div>
  </div>
</template>
