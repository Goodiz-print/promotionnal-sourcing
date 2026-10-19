<script setup lang="ts">
import FlagIcon from '~/components/flag_icon.vue'
import { inject } from 'vue'
import { useI18n } from '~/i18n'
import { CONTENT_LOCALES, LOCALE_LABELS } from '#shared/types/i18n'
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
        {{ LOCALE_LABELS[locale] }}
      </option>
    </BaseSelect>
    <p class="-mt-4 text-xs text-[var(--gray-6)]">{{ t('products.manage.sourceLocaleHint') }}</p>

    <div v-for="locale in CONTENT_LOCALES" :key="locale" class="flex flex-col gap-3">
      <h3 class="flex items-center gap-2 text-sm font-semibold text-[var(--gray-6)]">
        <FlagIcon :code="locale" />
        {{ LOCALE_LABELS[locale] }}
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
      <p v-if="locale !== form.sourceLocale" class="text-xs text-[var(--gray-6)]">
        {{ t('products.manage.autoHint') }}
      </p>
    </div>
  </div>
</template>
