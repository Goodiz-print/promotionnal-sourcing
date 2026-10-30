<script setup lang="ts">
import { computed, ref } from 'vue'
import { useForm } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import {
  CONTENT_LOCALES,
  CONTENT_LOCALE_LABELS,
  DEFAULT_CONTENT_LOCALE,
  type ContentLocale,
} from '#shared/types/i18n'
import { useVisibleContentLocales } from '~/composables/use_visible_content_locales'
import BaseButton from '~/components/base/base_button.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseLinkButton from '~/components/base/base_link_button.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseSelect from '~/components/base/base_select.vue'
import CategoryTranslationFieldset from '~/components/categories/form/category_translation_fieldset.vue'
import type { CategoryType, CategoryEditType } from '#shared/types/category'

const props = defineProps<{
  mode: 'create' | 'edit'
  parents: CategoryType[]
  category?: CategoryEditType
}>()

const { t, locale } = useI18n()

interface CategoryFormState {
  slug: string
  parentId: number | null
  synonyms: string
  translations: Record<ContentLocale, { name: string; description: string }>
}

function initialTranslations(): CategoryFormState['translations'] {
  const translations = {} as CategoryFormState['translations']
  for (const current of CONTENT_LOCALES) {
    translations[current] = {
      name: props.category?.translations[current]?.name ?? '',
      description: props.category?.translations[current]?.description ?? '',
    }
  }
  return translations
}

const form = useForm<CategoryFormState>({
  slug: props.category?.slug ?? '',
  parentId: props.category?.parentId ?? null,
  synonyms: props.category?.synonyms.join(', ') ?? '',
  translations: initialTranslations(),
})

const sourceLocale = ref<ContentLocale>(props.category?.sourceLocale ?? DEFAULT_CONTENT_LOCALE)
const { otherLocale, otherLocales, visibleLocales } = useVisibleContentLocales(sourceLocale)

function onOtherLocale(value: string | null) {
  if (value) otherLocale.value = value as ContentLocale
}

const indexUrl = computed(() => urlFor('admin.categories.index', { locale: locale.value }))

function errorFor(key: string): string | undefined {
  return (form.errors as Record<string, string | undefined>)[key]
}

function onParent(value: string | null) {
  form.parentId = value ? Number(value) : null
}

function submit() {
  form.transform((data) => {
    const synonyms = data.synonyms
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
    // Langue source toujours envoyée ; les autres seulement si renseignées (sinon
    // générées automatiquement par le serveur).
    const translations: Partial<Record<ContentLocale, { name: string; description: string }>> = {}
    for (const current of CONTENT_LOCALES) {
      if (current === sourceLocale.value || data.translations[current].name) {
        translations[current] = data.translations[current]
      }
    }
    const payload: Record<string, unknown> = {
      parentId: data.parentId,
      synonyms,
      sourceLocale: sourceLocale.value,
      translations,
    }
    if (props.mode === 'create') payload.slug = data.slug
    return payload
  })

  if (props.mode === 'create') {
    form.post(urlFor('admin.categories.store', { locale: locale.value }), { preserveScroll: true })
  } else {
    form.patch(
      urlFor('admin.categories.update', { locale: locale.value, id: props.category!.id }),
      { preserveScroll: true }
    )
  }
}
</script>

<template>
  <form class="flex flex-col gap-6" @submit.prevent="submit">
    <BaseSection
      as="fieldset"
      :title="t('categories.form.identity')"
      :description="t('categories.form.identityDescription')"
    >
      <div class="grid gap-5 sm:grid-cols-2">
        <BaseInput
          v-if="mode === 'create'"
          id="slug"
          v-model="form.slug"
          type="text"
          :label="t('categories.fields.slug')"
          :placeholder="t('categories.fields.slugPlaceholder')"
          :hint="t('categories.fields.slugHint')"
          :error="form.errors.slug"
          required
        />
        <BaseSelect
          id="parentId"
          :model-value="form.parentId === null ? '' : String(form.parentId)"
          :label="t('categories.fields.parent')"
          :error="errorFor('parentId')"
          @update:model-value="onParent"
        >
          <option value="">{{ t('categories.noParent') }}</option>
          <option v-for="parent in parents" :key="parent.id" :value="String(parent.id)">
            {{ parent.name ?? parent.slug }}
          </option>
        </BaseSelect>
      </div>
    </BaseSection>

    <BaseSelect
      id="other-locale"
      :model-value="otherLocale"
      :label="t('categories.form.otherLocale')"
      @update:model-value="onOtherLocale"
    >
      <option v-for="current in otherLocales" :key="current" :value="current">
        {{ CONTENT_LOCALE_LABELS[current] }}
      </option>
    </BaseSelect>

    <CategoryTranslationFieldset
      v-for="current in visibleLocales"
      :key="current"
      v-model:name="form.translations[current].name"
      v-model:description="form.translations[current].description"
      :locale="current"
      :name-error="errorFor(`translations.${current}.name`)"
      :description-error="errorFor(`translations.${current}.description`)"
    />

    <BaseSection
      as="fieldset"
      :title="t('categories.form.search')"
      :description="t('categories.form.searchDescription')"
    >
      <BaseInput
        id="synonyms"
        v-model="form.synonyms"
        type="text"
        :label="t('categories.fields.synonyms')"
        :placeholder="t('categories.fields.synonymsPlaceholder')"
        :hint="t('categories.fields.synonymsHint')"
        :error="errorFor('synonyms')"
      />
    </BaseSection>

    <div class="flex justify-end gap-3">
      <BaseLinkButton :href="indexUrl" variant="secondary">
        {{ t('categories.cancel') }}
      </BaseLinkButton>
      <BaseButton type="submit" :loading="form.processing">{{ t('categories.save') }}</BaseButton>
    </div>
  </form>
</template>
