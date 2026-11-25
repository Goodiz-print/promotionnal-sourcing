<script setup lang="ts">
import { computed } from 'vue'
import { Head } from '@inertiajs/vue3'
import { Ban, RotateCw } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import { useInboundMailActions } from '~/composables/use_inbound_mail_actions'
import { useTradeFormat } from '~/composables/use_trade_format'
import InboundMailAttach from '~/components/admin/inbound_mail/inbound_mail_attach.vue'
import InboundMailAttachments from '~/components/admin/inbound_mail/inbound_mail_attachments.vue'
import InboundMailStatusBadge from '~/components/admin/inbound_mail/inbound_mail_status_badge.vue'
import BaseButton from '~/components/base/base_button.vue'
import BaseDescriptionItem from '~/components/base/base_description_item.vue'
import BaseDescriptionList from '~/components/base/base_description_list.vue'
import BasePageHeader from '~/components/base/base_page_header.vue'
import BaseSection from '~/components/base/base_section.vue'
import type {
  AdminInboundMailDetail,
  AdminInboundMailRecipient,
} from '#shared/types/admin_inbound_mail'

const props = defineProps<{
  mail: AdminInboundMailDetail
  candidates: AdminInboundMailRecipient[]
  rfqSearch: number | null
}>()

const { t, locale } = useI18n()
const { dateTime, empty } = useTradeFormat()
const { replay, dismiss } = useInboundMailActions()

const title = computed(() => props.mail.subject ?? t('admin.inboundMail.noSubject'))
const sender = computed(() =>
  props.mail.senderName
    ? `${props.mail.senderName} <${props.mail.senderAddress}>`
    : props.mail.senderAddress
)
const knownSender = computed(() =>
  props.mail.senderKnown === null
    ? empty
    : t(`admin.inboundMail.detail.senderKnown.${props.mail.senderKnown ? 'yes' : 'no'}`)
)
</script>

<template>
  <Head :title="title" />

  <div class="flex flex-col gap-8">
    <BasePageHeader
      :title="title"
      :description="sender"
      :back-href="urlFor('admin.inbound_mail.index', { locale })"
      :back-label="t('admin.inboundMail.back')"
    >
      <template #meta>
        <InboundMailStatusBadge :status="mail.status" :rejection-reason="mail.rejectionReason" />
      </template>
      <template #actions>
        <BaseButton v-if="mail.dismissable" variant="secondary" @click="dismiss(mail.id)">
          <Ban :size="16" aria-hidden="true" />
          {{ t('admin.inboundMail.actions.dismiss') }}
        </BaseButton>
        <BaseButton v-if="mail.replayable" @click="replay(mail.id)">
          <RotateCw :size="16" aria-hidden="true" />
          {{ t('admin.inboundMail.actions.replay') }}
        </BaseButton>
      </template>
    </BasePageHeader>

    <BaseSection :title="t('admin.inboundMail.detail.summary')">
      <BaseDescriptionList :columns="3">
        <BaseDescriptionItem :label="t('admin.inboundMail.detail.recipient')">
          {{ mail.recipient ?? empty }}
        </BaseDescriptionItem>
        <BaseDescriptionItem :label="t('admin.inboundMail.columns.target')">
          <template v-if="mail.target">
            #{{ mail.target.rfqId }} {{ mail.target.rfqTitle }} — {{ mail.target.supplierName }}
          </template>
          <template v-else>{{ t('admin.inboundMail.unattached') }}</template>
        </BaseDescriptionItem>
        <BaseDescriptionItem :label="t('admin.inboundMail.detail.attachedManually')">
          {{ mail.attachedManuallyAt ? dateTime(mail.attachedManuallyAt) : empty }}
        </BaseDescriptionItem>
        <BaseDescriptionItem :label="t('admin.inboundMail.columns.receivedAt')">
          {{ dateTime(mail.receivedAt) }}
        </BaseDescriptionItem>
        <BaseDescriptionItem :label="t('admin.inboundMail.detail.processedAt')">
          {{ dateTime(mail.processedAt) }}
        </BaseDescriptionItem>
        <BaseDescriptionItem :label="t('admin.inboundMail.detail.senderKnownLabel')">
          {{ knownSender }}
        </BaseDescriptionItem>
        <BaseDescriptionItem :label="t('admin.inboundMail.detail.provider')">
          {{ mail.provider }}
        </BaseDescriptionItem>
        <BaseDescriptionItem :label="t('admin.inboundMail.detail.messageId')" full>
          <span class="break-all">{{ mail.messageId ?? empty }}</span>
        </BaseDescriptionItem>
      </BaseDescriptionList>
    </BaseSection>

    <InboundMailAttach
      v-if="mail.attachable"
      :mail-id="mail.id"
      :candidates="candidates"
      :rfq-search="rfqSearch"
    />

    <BaseSection v-if="mail.fullError" :title="t('admin.inboundMail.detail.error')">
      <pre class="overflow-x-auto text-caption whitespace-pre-wrap text-text-primary">{{
        mail.fullError
      }}</pre>
    </BaseSection>

    <BaseSection :title="t('admin.inboundMail.detail.body')">
      <p v-if="!mail.textBody" class="text-body-sm text-text-secondary">
        {{ t('admin.inboundMail.detail.noBody') }}
      </p>
      <pre v-else class="overflow-x-auto text-body-sm whitespace-pre-wrap text-text-primary">{{
        mail.textBody
      }}</pre>
    </BaseSection>

    <InboundMailAttachments :attachments="mail.attachments" />
  </div>
</template>
