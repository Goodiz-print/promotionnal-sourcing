<script setup lang="ts">
import { useForm } from '@inertiajs/vue3'
import { EyeOff } from 'lucide-vue-next'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'
import BaseButton from '~/components/base/base_button.vue'
import BaseTextarea from '~/components/base/base_textarea.vue'
import { ICON_SIZE } from '~/types/ui'

/**
 * Masquage d'un produit : le motif est obligatoire (validé et tracé côté serveur).
 * La requête est une visite Inertia ; les erreurs reviennent dans `form.errors`.
 */
const props = defineProps<{ productId: number }>()

const { t, locale } = useI18n()

const form = useForm({ reason: '' })

function submit() {
  if (!window.confirm(t('admin.products.actions.hide.confirm'))) return
  form.post(urlFor('admin.products.hide', { locale: locale.value, id: props.productId }), {
    preserveScroll: true,
    onSuccess: () => form.reset('reason'),
  })
}
</script>

<template>
  <form class="flex flex-col items-start gap-3" @submit.prevent="submit">
    <BaseTextarea
      id="product-hide-reason"
      v-model="form.reason"
      class="w-full"
      :label="t('admin.products.actions.hide.reasonLabel')"
      :error="form.errors.reason"
      :rows="3"
    />
    <BaseButton type="submit" variant="danger" :loading="form.processing">
      <template #icon><EyeOff :size="ICON_SIZE" aria-hidden="true" /></template>
      {{ t('admin.products.actions.hide.label') }}
    </BaseButton>
  </form>
</template>
