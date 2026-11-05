<script setup lang="ts">
import { ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { Languages } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseButton from '~/components/base/base_button.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseSelect from '~/components/base/base_select.vue'
import type { TranslatableEntity } from '#shared/types/ai'

/** Relance du rattrapage des traductions (traité par la queue, jamais en direct). */
defineProps<{ entities: TranslatableEntity[]; enabled: boolean }>()

const { t, locale } = useI18n()
const entity = ref<TranslatableEntity | null>(null)
const sending = ref(false)

function submit() {
  router.post(
    urlFor('admin.ai.backfill', { locale: locale.value }),
    entity.value ? { entity: entity.value } : {},
    {
      preserveScroll: true,
      onStart: () => (sending.value = true),
      onFinish: () => (sending.value = false),
    }
  )
}
</script>

<template>
  <BaseSection :title="t('admin.ai.backfill.title')" :description="t('admin.ai.backfill.hint')">
    <form class="flex flex-wrap items-end gap-4" @submit.prevent="submit">
      <BaseSelect id="ai-backfill-entity" v-model="entity" :label="t('admin.ai.backfill.entity')">
        <option :value="null">{{ t('admin.ai.backfill.all') }}</option>
        <option v-for="item in entities" :key="item" :value="item">
          {{ t(`admin.ai.entities.${item}`) }}
        </option>
      </BaseSelect>
      <BaseButton type="submit" :disabled="!enabled || sending">
        <Languages :size="16" aria-hidden="true" />
        {{ t('admin.ai.backfill.submit') }}
      </BaseButton>
    </form>
  </BaseSection>
</template>
