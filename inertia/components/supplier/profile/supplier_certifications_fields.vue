<script setup lang="ts">
import { Plus } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import BaseButton from '~/components/base/base_button.vue'
import BaseInput from '~/components/base/base_input.vue'

/**
 * Liste répétable des certifications du profil fournisseur : un champ texte par
 * certification, retirable, plus un bouton d'ajout. Le tableau est remplacé à
 * chaque changement (jamais muté en place) pour rester dans le flux `v-model`.
 * Les erreurs arrivent indexées (`certifications.0`) ou globales (`certifications`).
 */
defineProps<{ errors: Record<string, string | undefined> }>()

const model = defineModel<string[]>({ required: true })

const { t } = useI18n()

function add() {
  model.value = [...model.value, '']
}

function update(index: number, value: string) {
  model.value = model.value.map((current, i) => (i === index ? value : current))
}

function remove(index: number) {
  model.value = model.value.filter((_, i) => i !== index)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <p v-if="model.length === 0" class="text-body-sm text-text-secondary">
      {{ t('supplier.fields.certificationsEmpty') }}
    </p>

    <ul v-else class="flex flex-col gap-3">
      <li v-for="(certification, index) in model" :key="index" class="flex items-end gap-3">
        <BaseInput
          :id="`certification-${index}`"
          :model-value="certification"
          :placeholder="t('supplier.fields.certificationPlaceholder')"
          :error="errors[`certifications.${index}`]"
          class="flex-1"
          @update:model-value="(value) => update(index, value)"
        />
        <BaseButton variant="secondary" size="sm" class="mb-1" @click="remove(index)">
          {{ t('supplier.fields.certificationRemove') }}
        </BaseButton>
      </li>
    </ul>

    <p v-if="errors.certifications" role="alert" class="text-caption font-medium text-danger">
      {{ errors.certifications }}
    </p>

    <div>
      <BaseButton variant="ghost" size="sm" @click="add">
        <template #icon><Plus :size="16" aria-hidden="true" /></template>
        {{ t('supplier.fields.certificationAdd') }}
      </BaseButton>
    </div>
  </div>
</template>
