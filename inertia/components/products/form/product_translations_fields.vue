<script setup lang="ts">
import FlagIcon from '~/components/flag_icon.vue'
import { computed, inject } from 'vue'
import { useI18n } from '~/i18n'
import { CONTENT_LOCALES, CONTENT_LOCALE_LABELS, type ContentLocale } from '#shared/types/i18n'
import { useVisibleContentLocales } from '~/composables/use_visible_content_locales'
import BaseInput from '~/components/base/base_input.vue'
import BaseTextarea from '~/components/base/base_textarea.vue'
import BaseSelect from '~/components/base/base_select.vue'
import BaseBadge from '~/components/base/base_badge.vue'
import { ProductFormKey } from './types'

const props = defineProps<{
  // Langues dont le texte actuel est une traduction automatique (corrigeable).
  autoLocales?: readonly string[]
}>()

const form = inject(ProductFormKey)!

const { t } = useI18n()

const { otherLocale, otherLocales, visibleLocales } = useVisibleContentLocales(
  computed(() => form.sourceLocale),
  () => form.errors as Record<string, string | undefined>
)

function onOtherLocale(value: string | null) {
  if (value) otherLocale.value = value as ContentLocale
}

function errorFor(key: string): string | undefined {
  return (form.errors as Record<string, string | undefined>)[key]
}

function isAuto(locale: string): boolean {
  return (props.autoLocales ?? []).includes(locale) && locale !== form.sourceLocale
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <BaseSelect
      id="source-locale"
      v-model="form.sourceLocale"
      :label="t('products.manage.sourceLocale')"
      :error="errorFor('sourceLocale')"
    >
      <option v-for="locale in CONTENT_LOCALES" :key="locale" :value="locale">
        {{ CONTENT_LOCALE_LABELS[locale] }}
      </option>
    </BaseSelect>
    <p class="-mt-4 text-caption text-text-muted">{{ t('products.manage.sourceLocaleHint') }}</p>

    <BaseSelect
      id="other-locale"
      :model-value="otherLocale"
      :label="t('products.manage.otherLocale')"
      @update:model-value="onOtherLocale"
    >
      <option v-for="locale in otherLocales" :key="locale" :value="locale">
        {{ CONTENT_LOCALE_LABELS[locale] }}
      </option>
    </BaseSelect>

    <div v-for="locale in visibleLocales" :key="locale" class="flex flex-col gap-3">
      <h3 class="flex items-center gap-2 text-heading-sm text-text-secondary">
        <FlagIcon :code="locale" />
        {{ CONTENT_LOCALE_LABELS[locale] }}
        <BaseBadge v-if="locale === form.sourceLocale" tone="info">
          {{ t('products.manage.sourceBadge') }}
        </BaseBadge>
        <BaseBadge v-else-if="isAuto(locale)" tone="warning">
          {{ t('products.manage.autoBadge') }}
        </BaseBadge>
      </h3>
      <BaseInput
        :id="`name-${locale}`"
        v-model="form.translations[locale].name"
        type="text"
        :label="t('products.manage.fields.name')"
        :error="errorFor(`translations.${locale}.name`)"
      />
      <BaseTextarea
        :id="`description-${locale}`"
        v-model="form.translations[locale].description"
        :label="t('products.manage.fields.description')"
        :error="errorFor(`translations.${locale}.description`)"
      />
      <p v-if="locale !== form.sourceLocale" class="text-caption text-text-muted">
        {{ t('products.manage.autoHint') }}
      </p>
    </div>
  </div>
</template>
