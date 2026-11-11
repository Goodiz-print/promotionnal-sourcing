<script setup lang="ts">
import { computed } from 'vue'
import { useForm } from '@inertiajs/vue3'
import { Send } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseAlert from '~/components/base/base_alert.vue'
import BaseButton from '~/components/base/base_button.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseSection from '~/components/base/base_section.vue'
import BaseTextarea from '~/components/base/base_textarea.vue'

/**
 * Validation du panier : un en-tête commun, puis une demande par fournisseur.
 * `canSend` faux (rôle `member`) : les demandes sont créées en brouillon, ce
 * que le formulaire annonce avant l'envoi.
 */
const props = defineProps<{ supplierNames: string[]; canSend: boolean }>()

const { t, locale } = useI18n()

const form = useForm({ title: '', description: '', deadline: '' })

const count = computed(() => props.supplierNames.length)
const suppliers = computed(() => props.supplierNames.join(', '))

function submit() {
  // Champs facultatifs vides omis : VineJS les traite comme absents.
  form
    .transform((data) => ({
      title: data.title,
      description: data.description || null,
      deadline: data.deadline || null,
    }))
    .post(urlFor('quote_cart.checkout', { locale: locale.value }), { preserveScroll: true })
}
</script>

<template>
  <form @submit.prevent="submit">
    <BaseSection
      as="fieldset"
      :title="canSend ? t('quote_cart.checkout.title') : t('quote_cart.checkout.titleDraft')"
      :description="t('quote_cart.checkout.description')"
    >
      <div class="flex flex-col gap-5">
        <BaseInput
          id="quote-cart-title"
          v-model="form.title"
          :label="t('quote_cart.checkout.fieldTitle')"
          :hint="t('quote_cart.checkout.fieldTitleHint')"
          :error="form.errors.title"
          required
        />
        <BaseTextarea
          id="quote-cart-description"
          v-model="form.description"
          :rows="3"
          :label="t('quote_cart.checkout.fieldDescription')"
          :error="form.errors.description"
        />
        <BaseInput
          id="quote-cart-deadline"
          v-model="form.deadline"
          type="date"
          :label="t('quote_cart.checkout.fieldDeadline')"
          :error="form.errors.deadline"
        />
        <BaseAlert v-if="!canSend" tone="warning">
          {{ t('quote_cart.checkout.draftNotice') }}
        </BaseAlert>
      </div>

      <template #footer>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-body-sm text-text-secondary" data-testid="quote-cart-summary">
            {{
              canSend
                ? t('quote_cart.checkout.summary', { count, suppliers })
                : t('quote_cart.checkout.summaryDraft', { count, suppliers })
            }}
          </p>
          <BaseButton type="submit" :loading="form.processing">
            <template #icon><Send :size="18" aria-hidden="true" /></template>
            {{
              canSend
                ? t('quote_cart.checkout.submit', { count })
                : t('quote_cart.checkout.submitDraft', { count })
            }}
          </BaseButton>
        </div>
      </template>
    </BaseSection>
  </form>
</template>
