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
import { ATTRIBUTE_DATA_TYPES, type AttributeEditType } from '#shared/types/attribute'
import { useVisibleContentLocales } from '~/composables/use_visible_content_locales'
import FlagIcon from '~/components/flag_icon.vue'
import BaseButton from '~/components/base/base_button.vue'
import BaseCheckbox from '~/components/base/base_checkbox.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseLinkButton from '~/components/base/base_link_button.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseSelect from '~/components/base/base_select.vue'

const props = defineProps<{
  mode: 'create' | 'edit'
  attribute?: AttributeEditType
}>()

const { t, locale } = useI18n()

interface AttributeFormState {
  slug: string
  type: string
  unit: string
  isFilterable: boolean
  names: Record<ContentLocale, string>
}

function initialNames(): AttributeFormState['names'] {
  const names = {} as AttributeFormState['names']
  for (const current of CONTENT_LOCALES) {
    names[current] = props.attribute?.translations[current]?.name ?? ''
  }
  return names
}

const form = useForm<AttributeFormState>({
  slug: props.attribute?.slug ?? '',
  type: props.attribute?.type ?? 'enum',
  unit: props.attribute?.unit ?? '',
  isFilterable: props.attribute?.isFilterable ?? true,
  names: initialNames(),
})

const sourceLocale = ref<ContentLocale>(props.attribute?.sourceLocale ?? DEFAULT_CONTENT_LOCALE)
const { otherLocale, otherLocales, visibleLocales } = useVisibleContentLocales(
  sourceLocale,
  () => form.errors as Record<string, string | undefined>
)

function onOtherLocale(value: string | null) {
  if (value) otherLocale.value = value as ContentLocale
}

const indexUrl = computed(() => urlFor('admin.attributes.index', { locale: locale.value }))

function errorFor(key: string): string | undefined {
  return (form.errors as Record<string, string | undefined>)[key]
}

function submit() {
  form.transform((data) => {
    // Langue source toujours envoyée ; les autres seulement si renseignées (sinon
    // générées automatiquement par le serveur).
    const translations: Partial<Record<ContentLocale, { name: string }>> = {}
    for (const current of CONTENT_LOCALES) {
      if (current === sourceLocale.value || data.names[current]) {
        translations[current] = { name: data.names[current] }
      }
    }
    const payload: Record<string, unknown> = {
      unit: data.unit.trim() || null,
      isFilterable: data.isFilterable,
      sourceLocale: sourceLocale.value,
      translations,
    }
    if (props.mode === 'create') {
      payload.slug = data.slug
      payload.type = data.type
    }
    return payload
  })

  if (props.mode === 'create') {
    form.post(urlFor('admin.attributes.store', { locale: locale.value }), { preserveScroll: true })
  } else {
    form.patch(
      urlFor('admin.attributes.update', { locale: locale.value, id: props.attribute!.id }),
      { preserveScroll: true }
    )
  }
}
</script>

<template>
  <form class="flex flex-col gap-6" @submit.prevent="submit">
    <BaseSection
      as="fieldset"
      :title="t('attributes.form.identity')"
      :description="t('attributes.form.identityDescription')"
    >
      <div class="grid gap-5 sm:grid-cols-2">
        <BaseInput
          v-if="mode === 'create'"
          id="slug"
          v-model="form.slug"
          type="text"
          :label="t('attributes.fields.slug')"
          :placeholder="t('attributes.fields.slugPlaceholder')"
          :hint="t('attributes.fields.slugHint')"
          :error="form.errors.slug"
          required
        />
        <BaseSelect
          id="type"
          v-model="form.type"
          :label="t('attributes.fields.type')"
          :hint="t('attributes.fields.typeHint')"
          :error="form.errors.type"
          :disabled="mode === 'edit'"
        >
          <option v-for="type in ATTRIBUTE_DATA_TYPES" :key="type" :value="type">
            {{ t(`attributes.types.${type}`) }}
          </option>
        </BaseSelect>
        <BaseInput
          id="unit"
          v-model="form.unit"
          type="text"
          :label="t('attributes.fields.unit')"
          :placeholder="t('attributes.fields.unitPlaceholder')"
          :hint="t('attributes.fields.unitHint')"
          :error="form.errors.unit"
        />
        <BaseCheckbox
          id="isFilterable"
          v-model="form.isFilterable"
          :label="t('attributes.fields.isFilterable')"
          :description="t('attributes.fields.isFilterableHint')"
        />
      </div>
    </BaseSection>

    <BaseSelect
      id="other-locale"
      :model-value="otherLocale"
      :label="t('attributes.form.otherLocale')"
      @update:model-value="onOtherLocale"
    >
      <option v-for="current in otherLocales" :key="current" :value="current">
        {{ CONTENT_LOCALE_LABELS[current] }}
      </option>
    </BaseSelect>

    <BaseSection
      v-for="current in visibleLocales"
      :key="current"
      as="fieldset"
      :title="t('attributes.form.content', { language: CONTENT_LOCALE_LABELS[current] })"
    >
      <template #actions>
        <FlagIcon :code="current" />
      </template>
      <BaseInput
        :id="`name-${current}`"
        v-model="form.names[current]"
        type="text"
        :label="t('attributes.fields.name')"
        :error="errorFor(`translations.${current}.name`)"
      />
    </BaseSection>

    <div class="flex justify-end gap-3">
      <BaseLinkButton :href="indexUrl" variant="secondary">
        {{ t('attributes.cancel') }}
      </BaseLinkButton>
      <BaseButton type="submit" :loading="form.processing">{{ t('attributes.save') }}</BaseButton>
    </div>
  </form>
</template>
