<script setup lang="ts">
import { Head, useForm } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseAlert from '~/components/base/base_alert.vue'
import BaseButton from '~/components/base/base_button.vue'
import BaseInput from '~/components/base/base_input.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseSelect from '~/components/base/base_select.vue'
import BaseTextarea from '~/components/base/base_textarea.vue'
import DocumentManager from '~/components/documents/document_manager.vue'
import SupplierCertificationsFields from '~/components/supplier/profile/supplier_certifications_fields.vue'
import {
  DEFAULT_ORIGIN_SCOPES,
  DELIVERY_SCOPES,
  type SupplierProfileType,
} from '#shared/types/organization'
import type { ModerationNotice, ModerationStatus } from '#shared/types/moderation'
import type { BadgeTone } from '~/types/ui'
import { ORGANIZATION_DOCUMENT_KINDS, type OrganizationDocumentType } from '#shared/types/document'

const props = defineProps<{
  profile: SupplierProfileType | null
  documents: OrganizationDocumentType[]
  moderation: ModerationNotice
}>()

const { t, locale } = useI18n()

const MODERATION_TONES: Record<ModerationStatus, BadgeTone> = {
  pending: 'info',
  approved: 'success',
  rejected: 'danger',
}

const form = useForm({
  minOrderQuantity: props.profile?.minOrderQuantity ?? null,
  deliveryDays: props.profile?.deliveryDays ?? null,
  deliveryScope: props.profile?.deliveryScope ?? null,
  defaultOriginScope: props.profile?.defaultOriginScope ?? null,
  certifications: props.profile?.certifications ? [...props.profile.certifications] : [],
  bio: props.profile?.bio ?? '',
  responseTimeDays: props.profile?.responseTimeDays ?? null,
  quoteEmail: props.profile?.quoteEmail ?? '',
})

function documentLabel(document: OrganizationDocumentType) {
  return t(`documents.kinds.${document.kind}`)
}

function submit() {
  form
    .transform((data) => ({
      ...data,
      deliveryScope: data.deliveryScope || null,
      defaultOriginScope: data.defaultOriginScope || null,
      bio: data.bio.trim() ? data.bio.trim() : null,
      quoteEmail: data.quoteEmail.trim() || null,
      certifications: data.certifications.map((c) => c.trim()).filter((c) => c !== ''),
    }))
    .patch(urlFor('supplier.profile.update', { locale: locale.value }), { preserveScroll: true })
}
</script>

<template>
  <Head :title="t('supplier.profile.title')" />

  <div class="flex w-full flex-col gap-8">
    <BasePageHeader
      :title="t('supplier.profile.title')"
      :description="t('supplier.profile.subtitle')"
    />

    <BaseAlert
      :tone="MODERATION_TONES[moderation.status]"
      :title="t(`supplier.profile.moderation.${moderation.status}`)"
    >
      <template v-if="moderation.status === 'rejected' && moderation.reason">
        {{ t('supplier.profile.moderation.reason', { reason: moderation.reason }) }}
      </template>
      <template v-else>{{ t(`supplier.profile.moderation.${moderation.status}Hint`) }}</template>
    </BaseAlert>

    <form class="flex flex-col gap-6" @submit.prevent="submit">
      <BaseSection
        as="fieldset"
        :title="t('supplier.profile.sections.quoteReception')"
        :description="t('supplier.profile.sections.quoteReceptionHint')"
      >
        <BaseInput
          id="quoteEmail"
          v-model="form.quoteEmail"
          type="email"
          autocomplete="email"
          :label="t('supplier.fields.quoteEmail')"
          :hint="t('supplier.fields.quoteEmailHint')"
          :error="form.errors.quoteEmail"
        />
      </BaseSection>

      <BaseSection
        as="fieldset"
        :title="t('supplier.profile.sections.terms')"
        :description="t('supplier.profile.sections.termsHint')"
      >
        <div class="grid gap-5 sm:grid-cols-2">
          <BaseInput
            id="minOrderQuantity"
            v-model="form.minOrderQuantity"
            type="number"
            :min="0"
            :label="t('supplier.fields.minOrderQuantity')"
            :error="form.errors.minOrderQuantity"
          />
          <BaseInput
            id="deliveryDays"
            v-model="form.deliveryDays"
            type="number"
            :min="0"
            :label="t('supplier.fields.deliveryDays')"
            :error="form.errors.deliveryDays"
          />
          <BaseInput
            id="responseTimeDays"
            v-model="form.responseTimeDays"
            type="number"
            :min="0"
            :label="t('supplier.fields.responseTimeDays')"
            :error="form.errors.responseTimeDays"
          />
          <BaseSelect
            id="deliveryScope"
            v-model="form.deliveryScope"
            :label="t('supplier.fields.deliveryScope')"
            :error="form.errors.deliveryScope"
          >
            <option :value="null">{{ t('supplier.deliveryScope.none') }}</option>
            <option v-for="scope in DELIVERY_SCOPES" :key="scope" :value="scope">
              {{ t(`supplier.deliveryScope.${scope}`) }}
            </option>
          </BaseSelect>
          <BaseSelect
            id="defaultOriginScope"
            v-model="form.defaultOriginScope"
            :label="t('supplier.fields.defaultOriginScope')"
            :error="form.errors.defaultOriginScope"
          >
            <option :value="null">{{ t('supplier.originScope.none') }}</option>
            <option v-for="scope in DEFAULT_ORIGIN_SCOPES" :key="scope" :value="scope">
              {{ t(`supplier.originScope.${scope}`) }}
            </option>
          </BaseSelect>
        </div>
      </BaseSection>

      <BaseSection
        as="fieldset"
        :title="t('supplier.fields.certifications')"
        :description="t('supplier.profile.sections.certificationsHint')"
      >
        <SupplierCertificationsFields v-model="form.certifications" :errors="form.errors" />
      </BaseSection>

      <BaseSection as="fieldset" :title="t('supplier.profile.sections.presentation')">
        <BaseTextarea
          id="bio"
          v-model="form.bio"
          :rows="6"
          :label="t('supplier.fields.bio')"
          :error="form.errors.bio"
        />
      </BaseSection>

      <div
        class="sticky bottom-4 z-20 flex items-center justify-end gap-3 rounded-xl border border-hairline bg-white/90 px-4 py-3 shadow-elevation-2 backdrop-blur-md"
      >
        <BaseButton type="submit" :loading="form.processing">
          {{ t('supplier.profile.submit') }}
        </BaseButton>
      </div>
    </form>

    <DocumentManager
      :documents="documents"
      :kinds="ORGANIZATION_DOCUMENT_KINDS"
      :label-for="documentLabel"
      :store-url="urlFor('supplier.documents.store', { locale })"
      :destroy-url="(document) => urlFor('supplier.documents.destroy', { locale, id: document.id })"
      :title="t('documents.title')"
      :empty-label="t('documents.empty')"
    />
  </div>
</template>
