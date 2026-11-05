<script setup lang="ts">
import { computed } from 'vue'
import { useForm } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseButton from '~/components/base/base_button.vue'
import BaseCard from '~/components/base/base_card.vue'
import BaseCheckbox from '~/components/base/base_checkbox.vue'
import BaseInput from '~/components/base/base_input.vue'
import BaseLinkButton from '~/components/base/base_link_button.vue'
import BaseSelect from '~/components/base/base_select.vue'
import BaseTextarea from '~/components/base/base_textarea.vue'
import { ANNOUNCEMENT_AUDIENCES, type AnnouncementAudience } from '#shared/types/announcement'

/**
 * Formulaire d'une nouvelle annonce : segment (avec sa taille), canaux, contenu
 * français (obligatoire) et anglais (facultatif), confirmation explicite.
 */
const props = defineProps<{
  audienceSizes: Record<Exclude<AnnouncementAudience, 'organization'>, number>
}>()

const { t, locale } = useI18n()

const form = useForm({
  audience: 'all' as AnnouncementAudience,
  organizationId: '',
  inApp: true,
  email: false,
  titleFr: '',
  bodyFr: '',
  titleEn: '',
  bodyEn: '',
  confirm: false,
})

const errors = computed(() => form.errors as Record<string, string | undefined>)

function audienceLabel(audience: AnnouncementAudience): string {
  const label = t(`admin.announcements.audiences.${audience}`)
  return audience === 'organization'
    ? label
    : t('admin.announcements.form.audienceOption', {
        label,
        count: props.audienceSizes[audience],
      })
}

function submit() {
  form
    .transform((data) => ({
      audience: data.audience,
      organizationId: data.audience === 'organization' ? data.organizationId : undefined,
      channels: [data.inApp ? 'inApp' : null, data.email ? 'email' : null].filter(Boolean),
      titleFr: data.titleFr,
      bodyFr: data.bodyFr,
      titleEn: data.titleEn,
      bodyEn: data.bodyEn,
      confirm: data.confirm,
    }))
    .post(urlFor('admin.announcements.store', { locale: locale.value }))
}
</script>

<template>
  <form class="flex flex-col gap-6" @submit.prevent="submit">
    <BaseCard padding="md">
      <div class="flex flex-col gap-4">
        <BaseSelect
          id="announcement-audience"
          v-model="form.audience"
          :label="t('admin.announcements.form.audience')"
          :error="errors.audience"
        >
          <option v-for="audience in ANNOUNCEMENT_AUDIENCES" :key="audience" :value="audience">
            {{ audienceLabel(audience) }}
          </option>
        </BaseSelect>
        <BaseInput
          v-if="form.audience === 'organization'"
          id="announcement-organization"
          v-model="form.organizationId"
          type="number"
          :min="1"
          :label="t('admin.announcements.form.organizationId')"
          :hint="t('admin.announcements.form.organizationHint')"
          :error="errors.organizationId"
        />
        <fieldset class="flex flex-col gap-2">
          <legend class="text-label text-text-primary">
            {{ t('admin.announcements.form.channels') }}
          </legend>
          <BaseCheckbox
            id="announcement-in-app"
            v-model="form.inApp"
            :label="t('admin.announcements.channels.inApp')"
          />
          <BaseCheckbox
            id="announcement-email"
            v-model="form.email"
            :label="t('admin.announcements.channels.email')"
            :description="t('admin.announcements.form.emailHint')"
          />
          <p v-if="errors.channels" class="text-body-sm text-danger" role="alert">
            {{ errors.channels }}
          </p>
        </fieldset>
      </div>
    </BaseCard>

    <BaseCard padding="md">
      <div class="flex flex-col gap-4">
        <BaseInput
          id="announcement-title-fr"
          v-model="form.titleFr"
          required
          :label="t('admin.announcements.form.titleFr')"
          :error="errors.titleFr"
        />
        <BaseTextarea
          id="announcement-body-fr"
          v-model="form.bodyFr"
          required
          :rows="5"
          :label="t('admin.announcements.form.bodyFr')"
          :error="errors.bodyFr"
        />
        <BaseInput
          id="announcement-title-en"
          v-model="form.titleEn"
          :label="t('admin.announcements.form.titleEn')"
          :error="errors.titleEn"
        />
        <BaseTextarea
          id="announcement-body-en"
          v-model="form.bodyEn"
          :rows="5"
          :label="t('admin.announcements.form.bodyEn')"
          :error="errors.bodyEn"
        />
      </div>
    </BaseCard>

    <BaseCheckbox
      id="announcement-confirm"
      v-model="form.confirm"
      :label="t('admin.announcements.form.confirm')"
    />
    <p v-if="errors.confirm" class="text-body-sm text-danger" role="alert">{{ errors.confirm }}</p>

    <div class="flex justify-end gap-3">
      <BaseLinkButton variant="secondary" :href="urlFor('admin.announcements.index', { locale })">
        {{ t('admin.announcements.form.cancel') }}
      </BaseLinkButton>
      <BaseButton type="submit" :loading="form.processing">
        {{ t('admin.announcements.form.submit') }}
      </BaseButton>
    </div>
  </form>
</template>
