<script setup lang="ts">
import { Head, useForm } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseInput from '~/components/base/base_input.vue'
import BaseSelect from '~/components/base/base_select.vue'
import BaseTextarea from '~/components/base/base_textarea.vue'
import BaseButton from '~/components/base/base_button.vue'
import DocumentManager from '~/components/documents/document_manager.vue'
import {
  DEFAULT_ORIGIN_SCOPES,
  DELIVERY_SCOPES,
  type SupplierProfileType,
} from '#shared/types/organization'
import { ORGANIZATION_DOCUMENT_KINDS, type OrganizationDocumentType } from '#shared/types/document'

const props = defineProps<{
  profile: SupplierProfileType | null
  documents: OrganizationDocumentType[]
}>()

const { t, locale } = useI18n()

const form = useForm({
  minOrderQuantity: props.profile?.minOrderQuantity ?? null,
  deliveryDays: props.profile?.deliveryDays ?? null,
  deliveryScope: props.profile?.deliveryScope ?? null,
  defaultOriginScope: props.profile?.defaultOriginScope ?? null,
  certifications: props.profile?.certifications ? [...props.profile.certifications] : [],
  bio: props.profile?.bio ?? '',
  responseTimeDays: props.profile?.responseTimeDays ?? null,
})

function addCertification() {
  form.certifications.push('')
}

function removeCertification(index: number) {
  form.certifications.splice(index, 1)
}

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
      certifications: data.certifications.map((c) => c.trim()).filter((c) => c !== ''),
    }))
    .patch(urlFor('supplier.profile.update', { locale: locale.value }), { preserveScroll: true })
}
</script>

<template>
  <Head :title="t('supplier.profile.title')" />

  <div class="mx-auto flex max-w-[600px] flex-col justify-center">
    <div>
      <h1 class="mb-1.25 text-[32px] tracking-[-0.5px]">{{ t('supplier.profile.title') }}</h1>
      <p class="mb-12 text-lg text-[var(--gray-6)]">{{ t('supplier.profile.subtitle') }}</p>
    </div>

    <form class="flex flex-col gap-6" @submit.prevent="submit">
      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
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

      <div>
        <label class="mb-1 block text-sm font-medium">
          {{ t('supplier.fields.certifications') }}
        </label>
        <div class="flex flex-col gap-2">
          <div v-for="(_, index) in form.certifications" :key="index" class="flex gap-2">
            <BaseInput
              :id="`certification-${index}`"
              v-model="form.certifications[index]"
              type="text"
              :placeholder="t('supplier.fields.certificationPlaceholder')"
              class="flex-1"
            />
            <BaseButton variant="secondary" @click="removeCertification(index)">
              {{ t('supplier.fields.certificationRemove') }}
            </BaseButton>
          </div>
        </div>
        <BaseButton variant="link" class="mt-2" @click="addCertification">
          {{ t('supplier.fields.certificationAdd') }}
        </BaseButton>
      </div>

      <BaseTextarea
        id="bio"
        v-model="form.bio"
        :label="t('supplier.fields.bio')"
        :error="form.errors.bio"
      />

      <BaseButton type="submit" :disabled="form.processing">
        {{ t('supplier.profile.submit') }}
      </BaseButton>
    </form>

    <DocumentManager
      class="mt-12"
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
