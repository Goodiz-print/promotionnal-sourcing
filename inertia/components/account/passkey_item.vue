<script setup lang="ts">
import { ref } from 'vue'
import { useForm } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseInput from '~/components/base_input.vue'
import BaseButton from '~/components/base_button.vue'
import type { PasskeyType } from '#shared/types/passkey'

const props = defineProps<{ passkey: PasskeyType }>()

const { t, locale } = useI18n()

const editing = ref(false)
const form = useForm({ name: props.passkey.name })

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(locale.value)
}

function rename() {
  form.patch(urlFor('account.passkeys.update', { locale: locale.value, id: props.passkey.id }), {
    preserveScroll: true,
    onSuccess: () => (editing.value = false),
  })
}

function remove() {
  if (!window.confirm(t('account.passkeys.confirmRemove', { name: props.passkey.name }))) return

  form.delete(urlFor('account.passkeys.destroy', { locale: locale.value, id: props.passkey.id }), {
    preserveScroll: true,
  })
}
</script>

<template>
  <li class="flex flex-col gap-3 rounded border border-[var(--gray-4)] p-4">
    <form v-if="editing" class="flex items-end gap-3" @submit.prevent="rename">
      <div class="grow">
        <BaseInput
          :id="`passkey-name-${passkey.id}`"
          v-model="form.name"
          :label="t('account.passkeys.name')"
          :error="form.errors.name"
        />
      </div>
      <BaseButton type="submit" variant="secondary" :disabled="form.processing">
        {{ t('account.passkeys.save') }}
      </BaseButton>
    </form>

    <div v-else class="flex items-center justify-between gap-3">
      <div>
        <p class="font-medium">{{ passkey.name }}</p>
        <p class="text-sm text-[var(--gray-6)]">
          {{ t('account.passkeys.createdAt', { date: formatDate(passkey.createdAt) }) }}
          ·
          {{
            passkey.lastUsedAt
              ? t('account.passkeys.lastUsedAt', { date: formatDate(passkey.lastUsedAt) })
              : t('account.passkeys.neverUsed')
          }}
        </p>
      </div>
      <div class="flex gap-2">
        <BaseButton variant="secondary" @click="editing = true">
          {{ t('account.passkeys.rename') }}
        </BaseButton>
        <BaseButton variant="danger" :disabled="form.processing" @click="remove">
          {{ t('account.passkeys.remove') }}
        </BaseButton>
      </div>
    </div>
  </li>
</template>
