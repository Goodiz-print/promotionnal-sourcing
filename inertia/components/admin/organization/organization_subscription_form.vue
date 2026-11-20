<script setup lang="ts">
import { reactive } from 'vue'
import { useI18n } from '~/i18n'
import { useAdminSubscriptionActions } from '~/composables/use_admin_subscription_actions'
import BaseButton from '~/components/base/base_button.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseSelect from '~/components/base/base_select.vue'
import { dayInSubscriptionZone } from '#shared/helpers/subscription'
import { PAID_SUBSCRIPTION_PLANS } from '#shared/types/subscription'

/**
 * Saisie d'un abonnement manuel (#214) : formule, premier et dernier jour
 * couverts. Un premier jour futur programme l'abonnement, activé ce jour-là.
 */
const props = defineProps<{ organizationId: number }>()

const { t } = useI18n()
const { processing, create } = useAdminSubscriptionActions(props.organizationId)

const today = dayInSubscriptionZone()
const draft = reactive({ plan: PAID_SUBSCRIPTION_PLANS[0], startsOn: today, endsOn: '' })
</script>

<template>
  <form class="grid gap-4 sm:grid-cols-4 sm:items-end" @submit.prevent="create({ ...draft })">
    <BaseSelect
      id="subscription-plan"
      v-model="draft.plan"
      :label="t('admin.organizations.subscription.fields.plan')"
    >
      <option v-for="plan in PAID_SUBSCRIPTION_PLANS" :key="plan" :value="plan">
        {{ t(`subscription.plans.${plan}.name`) }}
      </option>
    </BaseSelect>
    <BaseInput
      id="subscription-starts-on"
      v-model="draft.startsOn"
      type="date"
      required
      :label="t('admin.organizations.subscription.fields.startsOn')"
    />
    <BaseInput
      id="subscription-ends-on"
      v-model="draft.endsOn"
      type="date"
      required
      :min="draft.startsOn"
      :label="t('admin.organizations.subscription.fields.endsOn')"
    />
    <BaseButton type="submit" :disabled="processing || !draft.endsOn">
      {{ t('admin.organizations.subscription.create') }}
    </BaseButton>
  </form>
</template>
