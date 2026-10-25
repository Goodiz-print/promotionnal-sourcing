<script setup lang="ts">
import { inject } from 'vue'
import { useI18n } from '~/i18n'
import BaseInput from '~/components/base/base_input.vue'
import BaseTextarea from '~/components/base/base_textarea.vue'
import BaseCheckbox from '~/components/base/base_checkbox.vue'
import type { CertificationType } from '#shared/types/certification'
import { ProductFormKey } from './types'

defineProps<{ certifications: CertificationType[] }>()

const form = inject(ProductFormKey)!

const { t } = useI18n()

function toggle(certificationId: number, checked: boolean) {
  form.certificationIds = checked
    ? [...form.certificationIds, certificationId]
    : form.certificationIds.filter((id) => id !== certificationId)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <BaseInput
      id="recycledContentPercent"
      v-model="form.recycledContentPercent"
      type="number"
      :min="0"
      :label="t('products.manage.fields.recycledContentPercent')"
      :error="form.errors.recycledContentPercent"
    />

    <BaseTextarea
      id="cautionComment"
      v-model="form.cautionComment"
      :rows="3"
      :label="t('products.manage.fields.cautionComment')"
      :error="form.errors.cautionComment"
    />

    <fieldset class="flex flex-col gap-2">
      <legend class="mb-1 text-sm font-medium">
        {{ t('products.manage.fields.certifications') }}
      </legend>
      <p v-if="certifications.length === 0" class="text-sm text-[var(--gray-6)]">
        {{ t('products.manage.noCertifications') }}
      </p>
      <BaseCheckbox
        v-for="certification in certifications"
        :id="`certification-${certification.id}`"
        :key="certification.id"
        :model-value="form.certificationIds.includes(certification.id)"
        :label="certification.name ?? certification.slug"
        @update:model-value="(checked) => toggle(certification.id, checked)"
      />
    </fieldset>
  </div>
</template>
