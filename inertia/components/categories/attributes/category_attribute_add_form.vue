<script setup lang="ts">
import { computed } from 'vue'
import { useForm } from '@inertiajs/vue3'
import { Plus } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseButton from '~/components/base/base_button.vue'
import BaseSelect from '~/components/base/base_select.vue'
import type { CategoryAttributeOption } from '#shared/types/category'

/** Ajout d'un attribut pas encore associé à la catégorie. */
const props = defineProps<{ categoryId: number; options: CategoryAttributeOption[] }>()

const { t, locale } = useI18n()

const form = useForm<{ attributeId: string }>({ attributeId: '' })

const error = computed(() => (form.errors as Record<string, string | undefined>).attributeId)

function submit() {
  if (!form.attributeId) return
  form.transform((data) => ({ attributeId: Number(data.attributeId) }))
  form.post(
    urlFor('admin.categories.attributes.store', {
      locale: locale.value,
      categoryId: props.categoryId,
    }),
    { preserveScroll: true, onSuccess: () => form.reset() }
  )
}
</script>

<template>
  <p v-if="options.length === 0" class="text-body-sm text-text-muted">
    {{ t('categories.attributes.noneAvailable') }}
  </p>
  <form v-else class="flex items-end gap-3" @submit.prevent="submit">
    <div class="min-w-0 flex-1 sm:max-w-sm">
      <BaseSelect
        id="category-attribute-new"
        v-model="form.attributeId"
        :label="t('categories.attributes.selectLabel')"
        :error="error"
      >
        <option value="">{{ t('categories.attributes.selectPlaceholder') }}</option>
        <option v-for="option in options" :key="option.id" :value="String(option.id)">
          {{ option.name ?? option.slug }}
        </option>
      </BaseSelect>
    </div>
    <BaseButton type="submit" :loading="form.processing" :disabled="!form.attributeId">
      <Plus :size="18" aria-hidden="true" />
      {{ t('categories.attributes.add') }}
    </BaseButton>
  </form>
</template>
