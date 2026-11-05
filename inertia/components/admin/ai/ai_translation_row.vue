<script setup lang="ts">
import { reactive } from 'vue'
import { router } from '@inertiajs/vue3'
import { Check } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseBadge from '~/components/base/base_badge.vue'
import BaseButton from '~/components/base/base_button.vue'
import BaseTextarea from '~/components/base/base_textarea.vue'
import { CONTENT_LOCALE_LABELS, type ContentLocale } from '#shared/types/i18n'
import type { AdminAiTranslationRow } from '#shared/types/admin_ai'

/**
 * Une traduction à relire : texte source en repère, champs modifiables. Enregistrer
 * (même sans changement) la marque comme relue : elle n'est plus jamais écrasée par l'IA.
 */
const props = defineProps<{ row: AdminAiTranslationRow }>()

const { t, locale } = useI18n()

const values = reactive<Record<string, string>>(
  Object.fromEntries(props.row.fields.map((field) => [field.name, field.value ?? '']))
)

function save() {
  router.patch(
    urlFor('admin.ai.translations.correct', {
      locale: locale.value,
      entity: props.row.entity,
      id: props.row.entityId,
      translationLocale: props.row.locale,
    }),
    { ...values },
    { preserveScroll: true }
  )
}
</script>

<template>
  <tr>
    <td class="whitespace-nowrap text-tabular">#{{ row.entityId }}</td>
    <td class="whitespace-nowrap font-semibold text-text-primary">
      {{ CONTENT_LOCALE_LABELS[row.locale as ContentLocale] ?? row.locale }}
    </td>
    <td class="min-w-80">
      <form class="flex flex-col gap-3" @submit.prevent="save">
        <div v-for="field in row.fields" :key="field.name" class="flex flex-col gap-1">
          <p v-if="field.source" class="text-caption text-text-muted">
            {{ row.sourceLocale.toUpperCase() }} — {{ field.source }}
          </p>
          <BaseTextarea
            :id="`ai-${row.entity}-${row.entityId}-${row.locale}-${field.name}`"
            v-model="values[field.name]"
            :label="t(`admin.ai.fields.${field.name}`)"
            :rows="field.name === 'description' ? 4 : 1"
          />
        </div>
        <div>
          <BaseButton type="submit" size="sm" variant="secondary">
            <Check :size="16" aria-hidden="true" />
            {{ t('admin.ai.translations.save') }}
          </BaseButton>
        </div>
      </form>
    </td>
    <td>
      <BaseBadge :tone="row.isAuto ? 'info' : 'success'">
        {{ t(row.isAuto ? 'admin.ai.origins.auto' : 'admin.ai.origins.manual') }}
      </BaseBadge>
    </td>
  </tr>
</template>
