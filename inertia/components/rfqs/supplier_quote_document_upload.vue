<script setup lang="ts">
import { computed } from 'vue'
import { useForm } from '@inertiajs/vue3'
import { Send } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseButton from '~/components/base/base_button.vue'
import BaseFileInput from '~/components/base/base_file_input.vue'
import BaseTextarea from '~/components/base/base_textarea.vue'

/**
 * Dépôt du devis PDF depuis l'écran d'une demande reçue (#230), en alternative
 * à la réponse par mail : le serveur lui applique le même traitement
 * (enregistrement, transmission à l'agence). Un dépôt réussi revient en
 * message flash et vide le formulaire ; un refus (validation, fichier qui n'est
 * pas un PDF, fil bloqué, demande déclinée) revient en erreur sous le champ
 * `file` et le formulaire garde sa saisie (`onSuccess` n'est pas appelé).
 */
const props = defineProps<{ rfqId: number }>()

const { t, locale } = useI18n()

const form = useForm<{ file: File | null; body: string }>({ file: null, body: '' })

const canSubmit = computed(() => form.file !== null && !form.processing)

function onFiles(files: File[]) {
  form.file = files[0] ?? null
}

function submit() {
  form.post(urlFor('supplier.quote_documents.store', { locale: locale.value, id: props.rfqId }), {
    forceFormData: true,
    preserveScroll: true,
    onSuccess: () => form.reset(),
  })
}
</script>

<template>
  <form
    class="flex flex-col gap-4 border-t border-hairline p-6"
    data-test="quote-document-upload"
    @submit.prevent="submit"
  >
    <BaseFileInput
      id="quote-document-file"
      accept="application/pdf,.pdf"
      :label="t('quote.supplier.documents.upload.file')"
      :prompt="t('quote.supplier.documents.upload.prompt')"
      :hint="t('quote.supplier.documents.upload.hint')"
      :error="form.errors.file"
      @change="onFiles"
    />
    <p v-if="form.file" class="text-body-sm text-text-secondary" data-test="selected-file">
      {{ form.file.name }}
    </p>
    <BaseTextarea
      id="quote-document-body"
      v-model="form.body"
      :label="t('quote.supplier.documents.upload.body')"
      :error="form.errors.body"
    />
    <div>
      <BaseButton type="submit" size="sm" :disabled="!canSubmit">
        <Send :size="16" aria-hidden="true" />
        {{ t('quote.supplier.documents.upload.submit') }}
      </BaseButton>
    </div>
  </form>
</template>
