<script setup lang="ts">
import { ref } from 'vue'
import { useForm } from '@inertiajs/vue3'
import { KeyRound, Pencil, Trash2 } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseButton from '~/components/base/base_button.vue'
import BaseInput from '~/components/base/base_input.vue'
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

function cancelEdit() {
  form.reset()
  editing.value = false
}

function remove() {
  if (!window.confirm(t('account.passkeys.confirmRemove', { name: props.passkey.name }))) return

  form.delete(urlFor('account.passkeys.destroy', { locale: locale.value, id: props.passkey.id }), {
    preserveScroll: true,
  })
}
</script>

<template>
  <li
    class="flex items-center justify-between gap-4 border-b border-hairline py-3 first:pt-0 last:border-0 last:pb-0"
  >
    <form
      v-if="editing"
      class="flex grow flex-col gap-3 sm:flex-row sm:items-end"
      @submit.prevent="rename"
    >
      <div class="grow">
        <BaseInput
          :id="`passkey-name-${passkey.id}`"
          v-model="form.name"
          :label="t('account.passkeys.name')"
          :error="form.errors.name"
        />
      </div>
      <div class="flex shrink-0 gap-2">
        <BaseButton variant="secondary" size="sm" @click="cancelEdit">
          {{ t('account.passkeys.cancel') }}
        </BaseButton>
        <BaseButton type="submit" size="sm" :loading="form.processing">
          {{ t('account.passkeys.save') }}
        </BaseButton>
      </div>
    </form>

    <template v-else>
      <div class="flex min-w-0 items-center gap-3">
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-subtle text-indigo-600"
          aria-hidden="true"
        >
          <KeyRound :size="18" />
        </span>
        <div class="flex min-w-0 flex-col">
          <p class="truncate text-body-sm font-semibold text-text-primary">{{ passkey.name }}</p>
          <p class="text-caption text-text-secondary">
            {{ t('account.passkeys.createdAt', { date: formatDate(passkey.createdAt) }) }}
            ·
            {{
              passkey.lastUsedAt
                ? t('account.passkeys.lastUsedAt', { date: formatDate(passkey.lastUsedAt) })
                : t('account.passkeys.neverUsed')
            }}
          </p>
        </div>
      </div>
      <div class="flex shrink-0 gap-2">
        <BaseButton variant="secondary" size="sm" @click="editing = true">
          <template #icon><Pencil :size="16" aria-hidden="true" /></template>
          {{ t('account.passkeys.rename') }}
        </BaseButton>
        <BaseButton variant="danger" size="sm" :disabled="form.processing" @click="remove">
          <template #icon><Trash2 :size="16" aria-hidden="true" /></template>
          {{ t('account.passkeys.remove') }}
        </BaseButton>
      </div>
    </template>
  </li>
</template>
