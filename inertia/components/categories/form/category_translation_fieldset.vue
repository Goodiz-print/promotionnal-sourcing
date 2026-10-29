<script setup lang="ts">
import { useI18n } from '~/i18n'
import FlagIcon from '~/components/flag_icon.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseTextarea from '~/components/base/base_textarea.vue'
import { LOCALE_LABELS, type ContentLocale } from '#shared/types/i18n'

/**
 * Groupe de champs d'une langue du formulaire de catégorie : nom et description.
 * Le drapeau est décoratif, le nom de la langue figure dans le titre du groupe.
 */
defineProps<{
  locale: ContentLocale
  nameError?: string
  descriptionError?: string
}>()

const name = defineModel<string>('name', { required: true })
const description = defineModel<string>('description', { required: true })

const { t } = useI18n()
</script>

<template>
  <BaseSection
    as="fieldset"
    :title="t('categories.form.content', { language: LOCALE_LABELS[locale] })"
  >
    <template #actions>
      <FlagIcon :code="locale" />
    </template>
    <div class="flex flex-col gap-5">
      <BaseInput
        :id="`name-${locale}`"
        v-model="name"
        type="text"
        :label="t('categories.fields.name')"
        :error="nameError"
      />
      <BaseTextarea
        :id="`description-${locale}`"
        v-model="description"
        :label="t('categories.fields.description')"
        :error="descriptionError"
      />
    </div>
  </BaseSection>
</template>
