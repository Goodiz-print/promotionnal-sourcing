<script setup lang="ts">
import { computed, ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseAlert from '~/components/base/base_alert.vue'
import BaseButton from '~/components/base/base_button.vue'
import BaseInput from '~/components/base/base_input.vue'

/**
 * Adresse de réception des demandes de devis (#217) et son état de
 * confirmation. Une adresse enregistrée mais pas encore confirmée par le lien
 * reçu n'est pas utilisée : l'encart le dit et propose de renvoyer le lien.
 */
const props = defineProps<{
  /** Adresse enregistrée et date de sa confirmation, telles que lues en base. */
  savedEmail: string | null
  verifiedAt: string | null
  error?: string
}>()

const model = defineModel<string>({ required: true })

const { t, locale } = useI18n()
const resending = ref(false)

const isEdited = computed(
  () => model.value.trim().toLowerCase() !== (props.savedEmail ?? '').toLowerCase()
)
const isPending = computed(() => Boolean(props.savedEmail) && !props.verifiedAt && !isEdited.value)
const isVerified = computed(() => Boolean(props.savedEmail && props.verifiedAt) && !isEdited.value)

function resend() {
  router.post(
    urlFor('supplier.profile.quoteEmail.resend', { locale: locale.value }),
    {},
    {
      preserveScroll: true,
      onStart: () => (resending.value = true),
      onFinish: () => (resending.value = false),
    }
  )
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <BaseInput
      id="quoteEmail"
      v-model="model"
      type="email"
      autocomplete="email"
      :label="t('supplier.fields.quoteEmail')"
      :hint="
        isEdited && model.trim()
          ? t('supplier.profile.quoteEmail.willSend')
          : t('supplier.fields.quoteEmailHint')
      "
      :error="error"
    />

    <BaseAlert v-if="isPending" tone="warning" :title="t('supplier.profile.quoteEmail.pending')">
      <div class="flex flex-col items-start gap-3">
        <span>{{ t('supplier.profile.quoteEmail.pendingHint', { email: savedEmail ?? '' }) }}</span>
        <BaseButton variant="secondary" size="sm" :loading="resending" @click="resend">
          {{ t('supplier.profile.quoteEmail.resend') }}
        </BaseButton>
      </div>
    </BaseAlert>

    <BaseAlert v-else-if="isVerified" tone="success">
      {{ t('supplier.profile.quoteEmail.verified', { email: savedEmail ?? '' }) }}
    </BaseAlert>
  </div>
</template>
