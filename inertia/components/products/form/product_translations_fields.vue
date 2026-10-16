<script setup lang="ts">
import FlagIcon from '~/components/flag_icon.vue'
import { inject } from 'vue'
import { useI18n } from '~/i18n'
import { CONTENT_LOCALES, LOCALE_LABELS } from '#shared/types/i18n'
import BaseInput from '~/components/base/base_input.vue'
import BaseTextarea from '~/components/base/base_textarea.vue'
import { ProductFormKey } from './types'

const form = inject(ProductFormKey)!

const { t } = useI18n()

function errorFor(key: string): string | undefined {
  return (form.errors as Record<string, string | undefined>)[key]
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div v-for="locale in CONTENT_LOCALES" :key="locale" class="flex flex-col gap-3">
      <h3 class="flex items-center gap-2 text-sm font-semibold text-[var(--gray-6)]">
        <FlagIcon :code="locale" />
        {{ LOCALE_LABELS[locale] }}
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
    </div>
  </div>
</template>
