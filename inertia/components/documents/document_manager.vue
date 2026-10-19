<script setup lang="ts" generic="D extends DocumentType">
import { computed } from 'vue'
import { router, useForm } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import BaseButton from '~/components/base/base_button.vue'
import BaseFileInput from '~/components/base/base_file_input.vue'
import BaseSelect from '~/components/base/base_select.vue'
import DocumentList from '~/components/documents/document_list.vue'
import type { DocumentType } from '#shared/types/document'

const props = defineProps<{
  documents: D[]
  /** Route d'ajout (POST multipart). */
  storeUrl: string
  /** Route de retrait d'un document (DELETE). */
  destroyUrl: (document: D) => string
  /** Natures proposées ; absent = pas de choix (fiche technique). */
  kinds?: readonly string[]
  /** Libellé d'un document (nature), pour la liste. */
  labelFor?: (document: D) => string | null
  title: string
  emptyLabel: string
}>()

const { t } = useI18n()

const form = useForm<{ kind: string | null; file: File | null }>({
  kind: props.kinds?.[0] ?? null,
  file: null,
})

const canSubmit = computed(() => form.file !== null && !form.processing)

function onFiles(files: File[]) {
  form.file = files[0] ?? null
}

function submit() {
  form
    .transform((data) => (data.kind === null ? { file: data.file } : data))
    .post(props.storeUrl, {
      forceFormData: true,
      preserveScroll: true,
      onSuccess: () => form.reset('file'),
    })
}

function remove(document: D) {
  if (!window.confirm(t('documents.confirmRemove', { name: document.originalName }))) return
  router.delete(props.destroyUrl(document), { preserveScroll: true })
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <h2 class="font-medium">{{ title }}</h2>

    <DocumentList v-if="documents.length > 0" :documents="documents" :label-for="labelFor">
      <template #actions="{ document }">
        <BaseButton variant="secondary" @click="remove(document)">
          {{ t('documents.remove') }}
        </BaseButton>
      </template>
    </DocumentList>
    <p v-else class="text-sm text-[var(--gray-6)]">{{ emptyLabel }}</p>

    <form class="flex flex-col gap-3" @submit.prevent="submit">
      <BaseSelect
        v-if="kinds"
        id="document-kind"
        v-model="form.kind"
        :label="t('documents.fields.kind')"
        :error="form.errors.kind"
      >
        <option v-for="kind in kinds" :key="kind" :value="kind">
          {{ t(`documents.kinds.${kind}`) }}
        </option>
      </BaseSelect>
      <BaseFileInput
        id="document-file"
        accept="application/pdf,.pdf"
        :label="t('documents.fields.file')"
        :error="form.errors.file"
        @change="onFiles"
      />
      <p v-if="form.file" class="text-sm text-[var(--gray-6)]">{{ form.file.name }}</p>
      <BaseButton type="submit" :disabled="!canSubmit">{{ t('documents.add') }}</BaseButton>
    </form>
  </section>
</template>
