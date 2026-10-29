<script setup lang="ts">
import { computed, inject } from 'vue'
import { useI18n } from '~/i18n'
import BaseInput from '~/components/base/base_input.vue'
import BaseSelect from '~/components/base/base_select.vue'
import BaseButton from '~/components/base/base_button.vue'
import type { MarkingTechniqueType } from '#shared/types/marking'
import type { ProductDocumentFile } from '#shared/types/document'
import { ProductFormKey } from './types'

const props = defineProps<{
  index: number
  markingTechniques: MarkingTechniqueType[]
  templateDocuments: ProductDocumentFile[]
}>()

defineEmits<{ remove: [] }>()

const form = inject(ProductFormKey)!

const { t } = useI18n()

// La position vit dans le formulaire injecté (pas dans un prop).
const position = computed(() => form.markingPositions[props.index])
// Erreurs imbriquées (`markingPositions.0.name`, `…techniques.1.markingTechniqueId`).
const errors = computed(() => form.errors as Record<string, string | undefined>)

const field = (name: string) => `markingPositions.${props.index}.${name}`

function addTechnique() {
  position.value.techniques = [
    ...position.value.techniques,
    { markingTechniqueId: null, maxColors: null, defaultSetupCharge: null },
  ]
}

function removeTechnique(techniqueIndex: number) {
  position.value.techniques = position.value.techniques.filter((_, i) => i !== techniqueIndex)
}

function onTechnique(techniqueIndex: number, raw: string | null) {
  position.value.techniques[techniqueIndex].markingTechniqueId = raw ? Number(raw) : null
}

function onTemplate(raw: string | null) {
  position.value.templateDocumentId = raw ? Number(raw) : null
}
</script>

<template>
  <fieldset class="flex flex-col gap-4 rounded-lg border border-hairline bg-sunken p-4">
    <div class="flex items-end gap-3">
      <BaseInput
        :id="`marking-${index}-name`"
        v-model="form.markingPositions[index].name"
        :label="t('products.manage.marking.positionName')"
        :error="errors[field('name')]"
        class="flex-1"
      />
      <BaseButton variant="danger" size="sm" class="mb-1" @click="$emit('remove')">
        {{ t('products.manage.marking.removePosition') }}
      </BaseButton>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <BaseInput
        :id="`marking-${index}-width`"
        v-model="form.markingPositions[index].maxWidthMm"
        type="number"
        :min="1"
        :label="t('products.manage.marking.maxWidthMm')"
        :error="errors[field('maxWidthMm')]"
      />
      <BaseInput
        :id="`marking-${index}-height`"
        v-model="form.markingPositions[index].maxHeightMm"
        type="number"
        :min="1"
        :label="t('products.manage.marking.maxHeightMm')"
        :error="errors[field('maxHeightMm')]"
      />
    </div>

    <BaseSelect
      v-if="templateDocuments.length > 0"
      :id="`marking-${index}-template`"
      :model-value="position.templateDocumentId === null ? '' : String(position.templateDocumentId)"
      :label="t('products.manage.marking.template')"
      :error="errors[field('templateDocumentId')]"
      @update:model-value="onTemplate"
    >
      <option value="">{{ t('products.manage.marking.noTemplate') }}</option>
      <option v-for="document in templateDocuments" :key="document.id" :value="String(document.id)">
        {{ document.originalName }}
      </option>
    </BaseSelect>

    <div class="flex flex-col gap-3 border-t border-hairline pt-4">
      <p class="text-eyebrow text-text-muted">{{ t('products.manage.marking.techniques') }}</p>
      <div
        v-for="(technique, techniqueIndex) in position.techniques"
        :key="techniqueIndex"
        class="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <BaseSelect
          :id="`marking-${index}-tech-${techniqueIndex}`"
          :model-value="
            technique.markingTechniqueId === null ? '' : String(technique.markingTechniqueId)
          "
          :label="t('products.manage.marking.technique')"
          :error="errors[field(`techniques.${techniqueIndex}.markingTechniqueId`)]"
          class="flex-1"
          @update:model-value="(raw) => onTechnique(techniqueIndex, raw)"
        >
          <option value="">{{ t('products.manage.marking.chooseTechnique') }}</option>
          <option v-for="item in markingTechniques" :key="item.id" :value="String(item.id)">
            {{ item.name ?? item.slug }}
          </option>
        </BaseSelect>
        <BaseInput
          :id="`marking-${index}-tech-${techniqueIndex}-colors`"
          v-model="position.techniques[techniqueIndex].maxColors"
          type="number"
          :min="1"
          :max="32"
          :label="t('products.manage.marking.maxColors')"
          :error="errors[field(`techniques.${techniqueIndex}.maxColors`)]"
          class="flex-1"
        />
        <BaseInput
          :id="`marking-${index}-tech-${techniqueIndex}-setup`"
          v-model="position.techniques[techniqueIndex].defaultSetupCharge"
          type="number"
          :min="0"
          :label="t('products.manage.marking.setupCharge')"
          :error="errors[field(`techniques.${techniqueIndex}.defaultSetupCharge`)]"
          class="flex-1"
        />
        <BaseButton
          variant="danger"
          size="sm"
          class="sm:mb-1"
          @click="removeTechnique(techniqueIndex)"
        >
          {{ t('products.manage.marking.removeTechnique') }}
        </BaseButton>
      </div>
      <div>
        <BaseButton variant="secondary" size="sm" @click="addTechnique">
          {{ t('products.manage.marking.addTechnique') }}
        </BaseButton>
      </div>
    </div>
  </fieldset>
</template>
