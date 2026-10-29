<script setup lang="ts" generic="D extends DocumentType">
import { computed } from 'vue'
import { router, useForm } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import BaseButton from '~/components/base/base_button.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseFileInput from '~/components/base/base_file_input.vue'
import BaseSelect from '~/components/base/base_select.vue'
import DocumentList from '~/components/documents/document_list.vue'
import type { DocumentType } from '#shared/types/document'

const props = withDefaults(
  defineProps<{
    documents: D[]
    /** Route d'ajout (POST multipart). */
    storeUrl: string
    /** Route de retrait d'un document (DELETE). */
    destroyUrl: (document: D) => string
    /** Natures proposées ; absent = pas de choix (fiche technique). */
    kinds?: readonly string[]
    /** Nom du champ posté pour la nature (profil = `kind`, produit = `type`). */
    field?: string
    /** Préfixe de clé i18n des libellés de nature (`t('<prefix>.<valeur>')`). */
    optionLabelKey?: string
    /** Clé i18n du libellé du select de nature. */
    fieldLabelKey?: string
    /** Libellé d'un document (nature), pour la liste. */
    labelFor?: (document: D) => string | null
    title: string
    emptyLabel: string
  }>(),
  { field: 'kind', optionLabelKey: 'documents.kinds', fieldLabelKey: 'documents.fields.kind' }
)

const { t } = useI18n()

// Nature portée par `meta` ; le champ posté prend le nom `field` à la soumission
// (profil fournisseur = `kind`, fiche produit = `type`).
const form = useForm<{ meta: string | null; file: File | null }>({
  meta: props.kinds?.[0] ?? null,
  file: null,
})

const canSubmit = computed(() => form.file !== null && !form.processing)

// L'erreur de validation revient sous le nom du champ posté (`field`).
const metaError = computed(() => (form.errors as Record<string, string | undefined>)[props.field])

function onFiles(files: File[]) {
  form.file = files[0] ?? null
}

function submit() {
  form
    .transform((data) =>
      data.meta === null ? { file: data.file } : { [props.field]: data.meta, file: data.file }
    )
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
  <BaseSection :title="title">
    <DocumentList v-if="documents.length > 0" :documents="documents" :label-for="labelFor">
      <template #actions="{ document }">
        <BaseButton variant="secondary" size="sm" @click="remove(document)">
          {{ t('documents.remove') }}
        </BaseButton>
      </template>
    </DocumentList>
    <p v-else class="text-body-sm text-text-secondary">{{ emptyLabel }}</p>

    <form class="mt-5 flex flex-col gap-4 border-t border-hairline pt-5" @submit.prevent="submit">
      <BaseSelect
        v-if="kinds"
        id="document-kind"
        v-model="form.meta"
        :label="t(fieldLabelKey)"
        :error="metaError"
      >
        <option v-for="kind in kinds" :key="kind" :value="kind">
          {{ t(`${optionLabelKey}.${kind}`) }}
        </option>
      </BaseSelect>
      <BaseFileInput
        id="document-file"
        accept="application/pdf,.pdf"
        :label="t('documents.fields.file')"
        :error="form.errors.file"
        @change="onFiles"
      />
      <p v-if="form.file" class="text-body-sm text-text-secondary">{{ form.file.name }}</p>
      <div>
        <BaseButton type="submit" size="sm" :disabled="!canSubmit">{{
          t('documents.add')
        }}</BaseButton>
      </div>
    </form>
  </BaseSection>
</template>
