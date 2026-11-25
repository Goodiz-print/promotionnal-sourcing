<script setup lang="ts">
import { computed, ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { KeyRound, MailCheck, Pause, Play, Trash2 } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { useConfirm } from '~/composables/use_confirm'
import { urlFor } from '~/client'
import BaseButton from '~/components/base/base_button.vue'
import BaseTextarea from '~/components/base/base_textarea.vue'
import { ICON_SIZE } from '~/types/ui'
import type { AdminUserDetail } from '#shared/types/admin_user'

/**
 * Actions de la plateforme sur un compte : suspendre (motif optionnel), réactiver,
 * renvoyer la vérification, réinitialiser le mot de passe, supprimer. Les boutons
 * suivent `canSupport` / `canManage` ; suspendre et supprimer sont masqués sur son
 * propre compte, et un compte anonymisé n'en propose plus. Chaque action demande
 * une confirmation ; le serveur reste seul juge et répond par un flash.
 */
const props = defineProps<{ user: AdminUserDetail }>()

const { t, locale } = useI18n()
const { confirm } = useConfirm()

const REASON_MAX_LENGTH = 500

/** Un envoi à la fois : pendant la requête, tous les boutons sont désactivés. */
const processing = ref(false)
const reason = ref('')

const anonymized = computed(() => props.user.email.startsWith('deleted-'))
const suspended = computed(() => props.user.suspendedAt !== null)
const canSuspend = computed(
  () => props.user.canManage && !props.user.isSelf && !suspended.value && !anonymized.value
)
const canReactivate = computed(() => props.user.canManage && suspended.value && !anonymized.value)
const canResend = computed(
  () => props.user.canSupport && !props.user.emailVerified && !anonymized.value
)
const canReset = computed(() => props.user.canSupport && !anonymized.value)
const canDestroy = computed(() => props.user.canManage && !props.user.isSelf && !anonymized.value)
const hasActions = computed(
  () =>
    canSuspend.value || canReactivate.value || canResend.value || canReset.value || canDestroy.value
)

type PostAction = 'suspend' | 'reactivate' | 'resend_verification' | 'password_reset'

/** Clé de traduction (`admin.users.actions.<clé>.confirm` / `.label`) de chaque action. */
const POST_ACTION_KEYS: Record<PostAction, string> = {
  suspend: 'suspend',
  reactivate: 'reactivate',
  resend_verification: 'resendVerification',
  password_reset: 'passwordReset',
}

const visitOptions = {
  preserveScroll: true,
  onStart: () => (processing.value = true),
  onFinish: () => (processing.value = false),
}

async function post(action: PostAction, data: Record<string, string> = {}) {
  const key = POST_ACTION_KEYS[action]
  const confirmed = await confirm({
    message: t(`admin.users.actions.${key}.confirm`),
    confirmLabel: t(`admin.users.actions.${key}.label`),
    tone: action === 'suspend' ? 'danger' : 'default',
  })
  if (!confirmed) return
  router.post(
    urlFor(`admin.users.${action}`, { locale: locale.value, id: props.user.id }),
    data,
    visitOptions
  )
}

function suspend() {
  const trimmed = reason.value.trim().slice(0, REASON_MAX_LENGTH)
  post('suspend', trimmed ? { reason: trimmed } : {})
}

async function destroy() {
  const confirmed = await confirm({
    message: t('admin.users.actions.destroy.confirm'),
    confirmLabel: t('admin.users.actions.destroy.label'),
    tone: 'danger',
  })
  if (!confirmed) return
  router.delete(
    urlFor('admin.users.destroy', { locale: locale.value, id: props.user.id }),
    visitOptions
  )
}
</script>

<template>
  <p v-if="anonymized" class="text-body-sm text-text-secondary">
    {{ t('admin.users.show.anonymized') }}
  </p>
  <div v-else-if="hasActions" class="flex flex-col gap-4">
    <BaseTextarea
      v-if="canSuspend"
      id="suspend-reason"
      v-model="reason"
      :label="t('admin.users.actions.suspend.reasonLabel')"
      :rows="2"
    />
    <div class="flex flex-wrap items-center gap-3">
      <BaseButton v-if="canSuspend" variant="danger" :disabled="processing" @click="suspend">
        <template #icon><Pause :size="ICON_SIZE" aria-hidden="true" /></template>
        {{ t('admin.users.actions.suspend.label') }}
      </BaseButton>
      <BaseButton
        v-if="canReactivate"
        variant="secondary"
        :disabled="processing"
        @click="post('reactivate')"
      >
        <template #icon><Play :size="ICON_SIZE" aria-hidden="true" /></template>
        {{ t('admin.users.actions.reactivate.label') }}
      </BaseButton>
      <BaseButton
        v-if="canResend"
        variant="secondary"
        :disabled="processing"
        @click="post('resend_verification')"
      >
        <template #icon><MailCheck :size="ICON_SIZE" aria-hidden="true" /></template>
        {{ t('admin.users.actions.resendVerification.label') }}
      </BaseButton>
      <BaseButton
        v-if="canReset"
        variant="secondary"
        :disabled="processing"
        @click="post('password_reset')"
      >
        <template #icon><KeyRound :size="ICON_SIZE" aria-hidden="true" /></template>
        {{ t('admin.users.actions.passwordReset.label') }}
      </BaseButton>
      <BaseButton v-if="canDestroy" variant="danger" :disabled="processing" @click="destroy">
        <template #icon><Trash2 :size="ICON_SIZE" aria-hidden="true" /></template>
        {{ t('admin.users.actions.destroy.label') }}
      </BaseButton>
    </div>
  </div>
</template>
