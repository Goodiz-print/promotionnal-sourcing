<script setup lang="ts">
import FlagIcon from '~/components/flag_icon.vue'
import { useForm, router } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { CONTENT_LOCALES, LOCALE_LABELS, type ContentLocale } from '#shared/types/i18n'
import BaseButton from '~/components/base/base_button.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseTextarea from '~/components/base/base_textarea.vue'
import BaseSelect from '~/components/base/base_select.vue'
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
    const payload: Record<string, unknown> = {
      parentId: data.parentId,
      synonyms,
      translations: data.translations,
    }
    if (props.mode === 'create') payload.slug = data.slug
    return payload
  })

  if (props.mode === 'create') {
    form.post(urlFor('admin.categories.store', { locale: locale.value }), { preserveScroll: true })
  } else {
    form.patch(
      urlFor('admin.categories.update', { locale: locale.value, id: props.category!.id }),
      {
        preserveScroll: true,
      }
    )
  }
}

function cancel() {
  router.get(urlFor('admin.categories.index', { locale: locale.value }))
}
</script>

<template>
  <form class="flex max-w-[640px] flex-col gap-8" @submit.prevent="submit">
    <div class="flex flex-col gap-4">
      <BaseInput
        v-if="mode === 'create'"
        id="slug"
        v-model="form.slug"
        type="text"
        :label="t('categories.fields.slug')"
        :placeholder="t('categories.fields.slugHint')"
        :error="form.errors.slug"
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

    <div v-for="current in CONTENT_LOCALES" :key="current" class="flex flex-col gap-3">
      <h3 class="flex items-center gap-2 text-sm font-semibold text-[var(--gray-6)]">
        <FlagIcon :code="current" />
        {{ LOCALE_LABELS[current] }}
      </h3>
      <BaseInput
        :id="`name-${current}`"
        v-model="form.translations[current].name"
        type="text"
        :label="t('categories.fields.name')"
        :error="errorFor(`translations.${current}.name`)"
      />
      <BaseTextarea
        :id="`description-${current}`"
        v-model="form.translations[current].description"
        :label="t('categories.fields.description')"
        :error="errorFor(`translations.${current}.description`)"
      />
    </div>

    <BaseInput
      id="synonyms"
      v-model="form.synonyms"
      type="text"
      :label="t('categories.fields.synonyms')"
      :placeholder="t('categories.fields.synonymsHint')"
      :error="errorFor('synonyms')"
    />

    <div class="flex gap-3">
      <BaseButton type="submit" :disabled="form.processing">{{ t('categories.save') }}</BaseButton>
      <BaseButton variant="secondary" @click="cancel">{{ t('categories.cancel') }}</BaseButton>
    </div>
  </form>
</template>
