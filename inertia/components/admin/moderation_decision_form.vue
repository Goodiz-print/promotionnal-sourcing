<script setup lang="ts">
import { useForm } from '@inertiajs/vue3'
import { Check, X } from 'lucide-vue-next'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'
import BaseButton from '~/components/base/base_button.vue'
import BaseCard from '~/components/base/base_card.vue'
import BaseTextarea from '~/components/base/base_textarea.vue'
import type { ModerationDecision, ModerationTargetType } from '#shared/types/moderation'

/**
 * Décision sur un élément : approuver, ou rejeter avec un motif obligatoire. La
 * requête est une visite Inertia ; le serveur re-vérifie le droit, valide le
 * motif et trace la décision dans le journal d'audit.
 */
const props = defineProps<{ targetType: ModerationTargetType; targetId: number }>()

const { t, locale } = useI18n()

const form = useForm<{ status: ModerationDecision; reason: string }>({
  status: 'approved',
  reason: '',
})

function decide(status: ModerationDecision) {
  form
    .transform((data) => ({
      status,
      reason: status === 'rejected' ? data.reason : undefined,
    }))
    .post(
      urlFor('admin.moderation.decide', {
        locale: locale.value,
        type: props.targetType,
        id: props.targetId,
      }),
      {
        preserveScroll: true,
        onSuccess: () => form.reset('reason'),
      }
    )
}
</script>

<template>
  <BaseCard padding="md">
    <form class="flex flex-col gap-4" @submit.prevent>
      <h2 class="text-heading-md text-text-primary">{{ t('admin.moderation.form.title') }}</h2>

      <BaseTextarea
        id="moderation-reason"
        v-model="form.reason"
        :label="t('admin.moderation.form.reason')"
        :hint="t('admin.moderation.form.reasonHint')"
        :error="form.errors.reason"
        :rows="3"
      />

      <div class="flex flex-wrap gap-3">
        <BaseButton :loading="form.processing" @click="decide('approved')">
          <template #icon><Check :size="16" aria-hidden="true" /></template>
          {{ t('admin.moderation.form.approve') }}
        </BaseButton>
        <BaseButton variant="danger" :loading="form.processing" @click="decide('rejected')">
          <template #icon><X :size="16" aria-hidden="true" /></template>
          {{ t('admin.moderation.form.reject') }}
        </BaseButton>
      </div>
    </form>
  </BaseCard>
</template>
