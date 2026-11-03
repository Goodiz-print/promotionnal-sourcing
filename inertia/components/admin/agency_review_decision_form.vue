<script setup lang="ts">
import { useForm } from '@inertiajs/vue3'
import { Check, MessageSquareMore, X } from 'lucide-vue-next'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'
import BaseButton from '~/components/base/base_button.vue'
import BaseCard from '~/components/base/base_card.vue'
import BaseTextarea from '~/components/base/base_textarea.vue'
import {
  AGENCY_REVIEW_REASON_REQUIRED,
  type AgencyReviewDecision,
} from '#shared/types/agency_review'

/**
 * Décision sur une inscription agence : valider, rejeter ou demander des
 * informations. Le motif (message envoyé à l'agence) est obligatoire pour les deux
 * dernières. La requête est une visite Inertia ; le serveur re-vérifie le droit,
 * valide le motif et trace la décision dans le journal d'audit.
 */
const props = defineProps<{ organizationId: number }>()

const { t, locale } = useI18n()

const form = useForm<{ decision: AgencyReviewDecision; reason: string }>({
  decision: 'approved',
  reason: '',
})

function decide(decision: AgencyReviewDecision) {
  form
    .transform((data) => ({
      decision,
      reason: AGENCY_REVIEW_REASON_REQUIRED.includes(decision) ? data.reason : undefined,
    }))
    .post(
      urlFor('admin.agency_reviews.decide', { locale: locale.value, id: props.organizationId }),
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
      <h2 class="text-heading-md text-text-primary">{{ t('admin.agencyReviews.form.title') }}</h2>

      <BaseTextarea
        id="agency-review-reason"
        v-model="form.reason"
        :label="t('admin.agencyReviews.form.reason')"
        :hint="t('admin.agencyReviews.form.reasonHint')"
        :error="form.errors.reason"
        :rows="4"
      />

      <div class="flex flex-wrap gap-3">
        <BaseButton :loading="form.processing" @click="decide('approved')">
          <template #icon><Check :size="16" aria-hidden="true" /></template>
          {{ t('admin.agencyReviews.form.approve') }}
        </BaseButton>
        <BaseButton
          variant="secondary"
          :loading="form.processing"
          @click="decide('info_requested')"
        >
          <template #icon><MessageSquareMore :size="16" aria-hidden="true" /></template>
          {{ t('admin.agencyReviews.form.requestInfo') }}
        </BaseButton>
        <BaseButton variant="danger" :loading="form.processing" @click="decide('rejected')">
          <template #icon><X :size="16" aria-hidden="true" /></template>
          {{ t('admin.agencyReviews.form.reject') }}
        </BaseButton>
      </div>
    </form>
  </BaseCard>
</template>
