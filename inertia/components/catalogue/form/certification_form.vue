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
import BaseCheckbox from '~/components/base/base_checkbox.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseLinkButton from '~/components/base/base_link_button.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseSelect from '~/components/base/base_select.vue'
import NameTranslationsFields from '~/components/catalogue/form/name_translations_fields.vue'
import { DEFAULT_CONTENT_LOCALE, type ContentLocale } from '#shared/types/i18n'
import {
  CERTIFICATION_DOMAINS,
  type CertificationDomain,
  type CertificationEditType,
} from '#shared/types/certification'

const props = defineProps<{
  mode: 'create' | 'edit'
  certification?: CertificationEditType
}>()

const { t, locale } = useI18n()

interface CertificationFormState {
  slug: string
  domain: CertificationDomain
  isEco: boolean
  synonyms: string
  translations: NameTranslations
}

const form = useForm<CertificationFormState>({
  slug: props.certification?.slug ?? '',
  domain: props.certification?.domain ?? CERTIFICATION_DOMAINS[0],
  isEco: props.certification?.isEco ?? false,
  synonyms: props.certification?.synonyms.join(', ') ?? '',
  translations: initialNameTranslations(props.certification?.translations),
})

const sourceLocale = ref<ContentLocale>(props.certification?.sourceLocale ?? DEFAULT_CONTENT_LOCALE)

const errors = computed(() => form.errors as Record<string, string | undefined>)
const indexUrl = computed(() => urlFor('admin.certifications.index', { locale: locale.value }))

function submit() {
  form.transform((data) => {
    const payload: Record<string, unknown> = {
      domain: data.domain,
      isEco: data.isEco,
      synonyms: parseSynonyms(data.synonyms),
      sourceLocale: sourceLocale.value,
      translations: buildNameTranslations(data.translations, sourceLocale.value),
    }
    if (props.mode === 'create') payload.slug = data.slug
    return payload
  })

  if (props.mode === 'create') {
    form.post(urlFor('admin.certifications.store', { locale: locale.value }), {
      preserveScroll: true,
    })
  } else {
    form.patch(
      urlFor('admin.certifications.update', { locale: locale.value, id: props.certification!.id }),
      { preserveScroll: true }
    )
  }
}
</script>

<template>
  <form class="flex flex-col gap-6" @submit.prevent="submit">
    <BaseSection
      as="fieldset"
      :title="t('certifications.form.identity')"
      :description="t('certifications.form.identityDescription')"
    >
      <div class="grid gap-5 sm:grid-cols-2">
        <BaseInput
          v-if="mode === 'create'"
          id="slug"
          v-model="form.slug"
          type="text"
          :label="t('certifications.fields.slug')"
          :placeholder="t('certifications.fields.slugPlaceholder')"
          :hint="t('certifications.fields.slugHint')"
          :error="errors.slug"
          required
        />
        <BaseSelect
          id="domain"
          v-model="form.domain"
          :label="t('certifications.fields.domain')"
          :hint="t('certifications.fields.domainHint')"
          :error="errors.domain"
        >
          <option v-for="domain in CERTIFICATION_DOMAINS" :key="domain" :value="domain">
            {{ t(`certifications.domains.${domain}`) }}
          </option>
        </BaseSelect>
        <BaseCheckbox
          id="isEco"
          v-model="form.isEco"
          :label="t('certifications.fields.isEco')"
          :description="t('certifications.fields.isEcoHint')"
        />
      </div>
    </BaseSection>

    <NameTranslationsFields
      v-model="form.translations"
      namespace="certifications"
      :source-locale="sourceLocale"
      :errors="errors"
    />

    <BaseSection as="fieldset" :title="t('certifications.fields.synonyms')">
      <BaseInput
        id="synonyms"
        v-model="form.synonyms"
        type="text"
        :label="t('certifications.fields.synonyms')"
        :placeholder="t('certifications.fields.synonymsPlaceholder')"
        :hint="t('certifications.fields.synonymsHint')"
        :error="errors.synonyms"
      />
    </BaseSection>

    <div class="flex justify-end gap-3">
      <BaseLinkButton :href="indexUrl" variant="secondary">
        {{ t('certifications.cancel') }}
      </BaseLinkButton>
      <BaseButton type="submit" :loading="form.processing">
        {{ t('certifications.save') }}
      </BaseButton>
    </div>
  </form>
</template>
