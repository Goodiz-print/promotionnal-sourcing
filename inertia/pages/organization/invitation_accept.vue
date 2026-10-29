<script setup lang="ts">
import { Head, useForm } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { useI18n } from '~/i18n'
import AuthLayout from '~/layouts/auth.vue'
import BaseButton from '~/components/base/base_button.vue'
import BaseLinkButton from '~/components/base/base_link_button.vue'
import type { OrganizationInvitationPreviewType } from '#shared/types/organization'

const props = defineProps<{
  invitation: OrganizationInvitationPreviewType
  currentUserEmail: string | null
  acceptActionUrl: string
  loginUrl: string
  signupUrl: string
}>()

defineOptions({ layout: AuthLayout })

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

  <div class="flex flex-col gap-8">
    <div class="flex flex-col gap-2">
      <h1 class="text-display-md">
        {{ t('organization.invitations.accept.title') }}
      </h1>
      <p class="text-body-md text-text-secondary">
        {{
          t('organization.invitations.accept.description', {
            organization: invitation.organizationName,
            role: invitation.roleName,
          })
        }}
      </p>
    </div>

    <BaseButton v-if="emailMatches" type="button" block :loading="form.processing" @click="accept">
      {{ t('organization.invitations.accept.submit') }}
    </BaseButton>

    <div v-else-if="currentUserEmail" class="flex flex-col gap-3 text-body-sm text-text-secondary">
      <p>
        {{ t('organization.invitations.accept.wrongAccount', { email: currentUserEmail }) }}
      </p>
      <Link :href="loginUrl" class="font-semibold text-indigo-600 hover:underline">
        {{ t('organization.invitations.accept.loginAsInvited') }}
      </Link>
    </div>

    <div v-else class="flex gap-3">
      <BaseLinkButton :href="loginUrl">
        {{ t('organization.invitations.accept.login') }}
      </BaseLinkButton>
      <BaseLinkButton :href="signupUrl" variant="secondary">
        {{ t('organization.invitations.accept.signup') }}
      </BaseLinkButton>
    </div>
  </div>
</template>
