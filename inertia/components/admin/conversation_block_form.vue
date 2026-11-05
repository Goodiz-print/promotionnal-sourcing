<script setup lang="ts">
import { useForm } from '@inertiajs/vue3'
import { Lock, LockOpen } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseButton from '~/components/base/base_button.vue'
import BaseTextarea from '~/components/base/base_textarea.vue'
import { ICON_SIZE } from '~/types/ui'

/**
 * Blocage / déblocage d'un fil. Bloquer demande un motif (tracé dans l'audit) ;
 * débloquer se fait en un clic. Le serveur reste seul juge de l'état.
 */
const props = defineProps<{ conversationId: number; blocked: boolean }>()

const { t, locale } = useI18n()
const form = useForm({ reason: '' })

function block() {
  form.post(urlFor('admin.messaging.block', { locale: locale.value, id: props.conversationId }), {
    preserveScroll: true,
    onSuccess: () => form.reset(),
  })
}

function unblock() {
  form.post(urlFor('admin.messaging.unblock', { locale: locale.value, id: props.conversationId }), {
    preserveScroll: true,
  })
}
</script>

<template>
  <BaseButton v-if="blocked" variant="secondary" :loading="form.processing" @click="unblock">
    <template #icon><LockOpen :size="ICON_SIZE" aria-hidden="true" /></template>
    {{ t('admin.messaging.actions.unblock') }}
  </BaseButton>
  <form v-else class="flex flex-col gap-3" @submit.prevent="block">
    <BaseTextarea
      id="block-reason"
      v-model="form.reason"
      :label="t('admin.messaging.block.reason')"
      :hint="t('admin.messaging.block.hint')"
      :error="form.errors.reason"
      :rows="3"
      required
    />
    <div>
      <BaseButton type="submit" variant="danger" :loading="form.processing">
        <template #icon><Lock :size="ICON_SIZE" aria-hidden="true" /></template>
        {{ t('admin.messaging.actions.block') }}
      </BaseButton>
    </div>
  </form>
</template>
