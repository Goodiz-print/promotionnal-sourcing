<script setup lang="ts">
import { useI18n } from '~/i18n'
import type { AttributeEditType } from '#shared/types/attribute'
import AttributeValueForm from '~/components/attributes/form/attribute_value_form.vue'
import BaseSection from '~/components/base/base_section.vue'

/**
 * Valeurs d'une facette énumérée, éditées en ligne : une ligne par valeur, puis
 * le formulaire d'ajout.
 */
defineProps<{ attribute: AttributeEditType }>()

const { t } = useI18n()
</script>

<template>
  <BaseSection
    :title="t('attributes.values.title')"
    :description="t('attributes.values.description')"
  >
    <div class="flex flex-col gap-6">
      <p v-if="attribute.values.length === 0" class="text-body-sm text-text-muted">
        {{ t('attributes.values.empty') }}
      </p>
      <AttributeValueForm
        v-for="value in attribute.values"
        :key="value.id"
        :attribute-id="attribute.id"
        :source-locale="attribute.sourceLocale"
        :value="value"
      />

      <div class="border-t border-hairline pt-6">
        <h3 class="mb-3 text-heading-sm text-text-primary">{{ t('attributes.values.new') }}</h3>
        <AttributeValueForm :attribute-id="attribute.id" :source-locale="attribute.sourceLocale" />
      </div>
    </div>
  </BaseSection>
</template>
