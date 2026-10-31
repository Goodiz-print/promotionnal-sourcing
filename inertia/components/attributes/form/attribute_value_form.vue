<script setup lang="ts">
import { useForm } from '@inertiajs/vue3'
import { Trash2 } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import type { ContentLocale } from '#shared/types/i18n'
import type { AttributeValueEditType } from '#shared/types/attribute'
import BaseButton from '~/components/base/base_button.vue'
import BaseIconButton from '~/components/base/base_icon_button.vue'
import BaseInput from '~/components/base/base_input.vue'

/**
 * Une valeur de facette, éditée en ligne : libellé de sa langue source et
 * synonymes. Sans `value`, le formulaire sert à en ajouter une (avec son slug,
 * figé ensuite) ; les autres langues sont générées.
 */
const props = defineProps<{
  attributeId: number
  sourceLocale: ContentLocale
  value?: AttributeValueEditType
}>()

const { t, locale } = useI18n()

const form = useForm({
  slug: '',
  label: props.value?.label ?? '',
  synonyms: props.value?.synonyms.join(', ') ?? '',
})

function errorFor(key: string): string | undefined {
  return (form.errors as Record<string, string | undefined>)[key]
}

function submit() {
  form.transform((data) => {
    const payload: Record<string, unknown> = {
      sourceLocale: props.value?.sourceLocale ?? props.sourceLocale,
      synonyms: data.synonyms
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
      translations: {
        [props.value?.sourceLocale ?? props.sourceLocale]: { label: data.label },
      },
    }
    if (!props.value) payload.slug = data.slug
    return payload
  })

  if (props.value) {
    form.patch(
      urlFor('admin.attribute_values.update', {
        locale: locale.value,
        id: props.attributeId,
        valueId: props.value.id,
      }),
      { preserveScroll: true }
    )
  } else {
    form.post(
      urlFor('admin.attribute_values.store', { locale: locale.value, id: props.attributeId }),
      { preserveScroll: true, onSuccess: () => form.reset() }
    )
  }
}

function destroy() {
  if (!props.value || !window.confirm(t('attributes.values.confirmDelete'))) return
  form.delete(
    urlFor('admin.attribute_values.destroy', {
      locale: locale.value,
      id: props.attributeId,
      valueId: props.value.id,
    }),
    { preserveScroll: true }
  )
}
</script>

<template>
  <form class="grid items-start gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]" @submit.prevent="submit">
    <BaseInput
      v-if="!value"
      id="value-slug-new"
      v-model="form.slug"
      type="text"
      :label="t('attributes.values.slug')"
      :placeholder="t('attributes.values.slugPlaceholder')"
      :error="errorFor('slug')"
      required
    />
    <p v-else class="pt-2 text-body-sm text-text-secondary">
      <span class="font-semibold text-text-primary">{{ value.slug }}</span>
      <span v-if="value.productsCount > 0" class="block text-caption text-text-muted">
        {{ t('attributes.values.productsCount', { count: value.productsCount }) }}
      </span>
    </p>
    <BaseInput
      :id="`value-label-${value?.id ?? 'new'}`"
      v-model="form.label"
      type="text"
      :label="t('attributes.values.label')"
      :error="errorFor(`translations.${value?.sourceLocale ?? sourceLocale}.label`)"
    />
    <BaseInput
      :id="`value-synonyms-${value?.id ?? 'new'}`"
      v-model="form.synonyms"
      type="text"
      :label="t('attributes.values.synonyms')"
      :placeholder="t('attributes.values.synonymsPlaceholder')"
      :error="errorFor('synonyms')"
    />
    <div class="flex items-center gap-2 pt-6">
      <BaseButton type="submit" size="sm" :loading="form.processing">
        {{ value ? t('attributes.save') : t('attributes.values.add') }}
      </BaseButton>
      <BaseIconButton v-if="value" :label="t('attributes.values.delete')" @click="destroy">
        <Trash2 :size="18" aria-hidden="true" />
      </BaseIconButton>
    </div>
  </form>
</template>
