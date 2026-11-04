<script setup lang="ts">
import { computed, ref } from 'vue'
import { useForm } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import {
  initialNameTranslations,
  buildNameTranslations,
  parseSynonyms,
  type NameTranslations,
} from '~/composables/use_name_translations'
import BaseButton from '~/components/base/base_button.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseLinkButton from '~/components/base/base_link_button.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseSelect from '~/components/base/base_select.vue'
import NameTranslationsFields from '~/components/catalogue/form/name_translations_fields.vue'
import { DEFAULT_CONTENT_LOCALE, type ContentLocale } from '#shared/types/i18n'
import { MARKING_TECHNIQUE_FAMILIES, type MarkingTechniqueEditType } from '#shared/types/marking'

const props = defineProps<{
  mode: 'create' | 'edit'
  technique?: MarkingTechniqueEditType
}>()

const { t, locale } = useI18n()

interface MarkingTechniqueFormState {
  slug: string
  family: string
  synonyms: string
  translations: NameTranslations
}

const form = useForm<MarkingTechniqueFormState>({
  slug: props.technique?.slug ?? '',
  family: props.technique?.family ?? MARKING_TECHNIQUE_FAMILIES[0],
  synonyms: props.technique?.synonyms.join(', ') ?? '',
  translations: initialNameTranslations(props.technique?.translations),
})

const sourceLocale = ref<ContentLocale>(props.technique?.sourceLocale ?? DEFAULT_CONTENT_LOCALE)

const errors = computed(() => form.errors as Record<string, string | undefined>)
const indexUrl = computed(() => urlFor('admin.marking_techniques.index', { locale: locale.value }))

// Une famille hors liste (donnée historique) reste sélectionnable telle quelle.
const families = computed<string[]>(() => {
  const known: string[] = [...MARKING_TECHNIQUE_FAMILIES]
  return known.includes(form.family) ? known : [form.family, ...known]
})

function submit() {
  form.transform((data) => {
    const payload: Record<string, unknown> = {
      family: data.family,
      synonyms: parseSynonyms(data.synonyms),
      sourceLocale: sourceLocale.value,
      translations: buildNameTranslations(data.translations, sourceLocale.value),
    }
    if (props.mode === 'create') payload.slug = data.slug
    return payload
  })

  if (props.mode === 'create') {
    form.post(urlFor('admin.marking_techniques.store', { locale: locale.value }), {
      preserveScroll: true,
    })
  } else {
    form.patch(
      urlFor('admin.marking_techniques.update', { locale: locale.value, id: props.technique!.id }),
      { preserveScroll: true }
    )
  }
}
</script>

<template>
  <form class="flex flex-col gap-6" @submit.prevent="submit">
    <BaseSection
      as="fieldset"
      :title="t('markingTechniques.form.identity')"
      :description="t('markingTechniques.form.identityDescription')"
    >
      <div class="grid gap-5 sm:grid-cols-2">
        <BaseInput
          v-if="mode === 'create'"
          id="slug"
          v-model="form.slug"
          type="text"
          :label="t('markingTechniques.fields.slug')"
          :placeholder="t('markingTechniques.fields.slugPlaceholder')"
          :hint="t('markingTechniques.fields.slugHint')"
          :error="errors.slug"
          required
        />
        <BaseSelect
          id="family"
          v-model="form.family"
          :label="t('markingTechniques.fields.family')"
          :hint="t('markingTechniques.fields.familyHint')"
          :error="errors.family"
        >
          <option v-for="family in families" :key="family" :value="family">
            {{ t(`markingTechniques.families.${family}`) }}
          </option>
        </BaseSelect>
      </div>
    </BaseSection>

    <NameTranslationsFields
      v-model="form.translations"
      namespace="markingTechniques"
      :source-locale="sourceLocale"
      :errors="errors"
    />

    <BaseSection as="fieldset" :title="t('markingTechniques.fields.synonyms')">
      <BaseInput
        id="synonyms"
        v-model="form.synonyms"
        type="text"
        :label="t('markingTechniques.fields.synonyms')"
        :placeholder="t('markingTechniques.fields.synonymsPlaceholder')"
        :hint="t('markingTechniques.fields.synonymsHint')"
        :error="errors.synonyms"
      />
    </BaseSection>

    <div class="flex justify-end gap-3">
      <BaseLinkButton :href="indexUrl" variant="secondary">
        {{ t('markingTechniques.cancel') }}
      </BaseLinkButton>
      <BaseButton type="submit" :loading="form.processing">
        {{ t('markingTechniques.save') }}
      </BaseButton>
    </div>
  </form>
</template>
