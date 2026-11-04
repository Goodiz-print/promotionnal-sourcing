<script setup lang="ts">
import { toRef } from 'vue'
import { useI18n } from '~/i18n'
import FlagIcon from '~/components/flag_icon.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseSelect from '~/components/base/base_select.vue'
import { useVisibleContentLocales } from '~/composables/use_visible_content_locales'
import type { NameTranslations } from '~/composables/use_name_translations'
import { CONTENT_LOCALE_LABELS, type ContentLocale } from '#shared/types/i18n'

/**
 * Champs « nom » par langue de contenu d'un référentiel (certification, technique
 * de marquage) : la langue source plus une autre langue au choix. `namespace`
 * désigne le fichier de traductions qui porte `form.content`, `form.otherLocale`
 * et `fields.name`.
 */
const props = defineProps<{
  namespace: 'certifications' | 'markingTechniques'
  sourceLocale: ContentLocale
  errors: Record<string, string | undefined>
}>()

const translations = defineModel<NameTranslations>({ required: true })

const { t } = useI18n()

const { otherLocale, otherLocales, visibleLocales } = useVisibleContentLocales(
  toRef(props, 'sourceLocale'),
  () => props.errors
)

function onOtherLocale(value: string | null) {
  if (value) otherLocale.value = value as ContentLocale
}

function onName(locale: ContentLocale, value: string) {
  translations.value = { ...translations.value, [locale]: { name: value } }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <BaseSelect
      id="other-locale"
      :model-value="otherLocale"
      :label="t(`${namespace}.form.otherLocale`)"
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
      :title="t(`${namespace}.form.content`, { language: CONTENT_LOCALE_LABELS[current] })"
    >
      <template #actions>
        <FlagIcon :code="current" />
      </template>
      <BaseInput
        :id="`name-${current}`"
        :model-value="translations[current].name"
        type="text"
        :label="t(`${namespace}.fields.name`)"
        :error="errors[`translations.${current}.name`]"
        @update:model-value="onName(current, $event)"
      />
    </BaseSection>
  </div>
</template>
