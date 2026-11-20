<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from '~/i18n'
import { useAdminSubscriptionActions } from '~/composables/use_admin_subscription_actions'
import BaseButton from '~/components/base/base_button.vue'
import BaseInput from '~/components/base/base_input.vue'
import { lastCoveredDay } from '#shared/helpers/subscription'
import type { AdminOrganizationSubscription } from '#shared/types/admin_organization'

/**
 * Actions sur un abonnement manuel ouvert (#214) : nouvelle date de fin (jour
 * inclus) et résiliation immédiate, avec confirmation.
 */
const props = defineProps<{
  organizationId: number
  subscription: AdminOrganizationSubscription
}>()

const { t } = useI18n()
const { processing, extend, cancel } = useAdminSubscriptionActions(props.organizationId)

const endsOn = ref(props.subscription.endsAt ? lastCoveredDay(props.subscription.endsAt) : '')
</script>

<template>
  <form
    class="flex flex-wrap items-end justify-end gap-2"
    @submit.prevent="extend(subscription.id, endsOn)"
  >
    <div class="w-40">
      <BaseInput
        :id="`subscription-${subscription.id}-ends-on`"
        v-model="endsOn"
        type="date"
        required
        :label="t('admin.organizations.subscription.fields.endsOn')"
      />
    </div>
    <BaseButton type="submit" variant="secondary" size="sm" :disabled="processing || !endsOn">
      {{ t('admin.organizations.subscription.extend') }}
    </BaseButton>
    <BaseButton
      type="button"
      variant="danger"
      size="sm"
      :disabled="processing"
      @click="cancel(subscription.id, t('admin.organizations.subscription.cancelConfirm'))"
    >
      {{ t('admin.organizations.subscription.cancel') }}
    </BaseButton>
  </form>
</template>
