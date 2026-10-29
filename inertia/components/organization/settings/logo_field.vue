<script setup lang="ts">
import { inject, computed } from 'vue'
import { ImageOff, X } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import BaseButton from '~/components/base/base_button.vue'
import BaseCheckbox from '~/components/base/base_checkbox.vue'
import BaseFileInput from '~/components/base/base_file_input.vue'
import { OrganizationSettingsFormKey } from './types'

const props = defineProps<{ currentLogoUrl: string | null }>()

const form = inject(OrganizationSettingsFormKey)!

const { t } = useI18n()

const previewUrl = computed(() =>
  form.logo ? URL.createObjectURL(form.logo) : props.currentLogoUrl
)

function onFile(files: File[]) {
  form.logo = files[0] ?? null
  if (form.logo) form.removeLogo = false
}

function cancelNewLogo() {
  form.logo = null
}
</script>

<template>
  <div class="flex flex-col gap-5 sm:flex-row sm:items-start">
    <div class="flex shrink-0 flex-col items-center gap-2">
      <img
        v-if="previewUrl"
        :src="previewUrl"
        alt=""
        class="size-16 rounded-xl border border-hairline bg-card object-contain"
      />
      <template v-else>
        <span
          class="flex size-16 items-center justify-center rounded-xl border border-dashed border-input bg-sunken text-text-muted"
          aria-hidden="true"
        >
          <ImageOff :size="20" />
        </span>
        <span class="text-caption text-text-muted">{{ t('organization.logo.none') }}</span>
      </template>
    </div>

    <div class="flex min-w-0 grow flex-col gap-3">
      <BaseFileInput
        id="logo"
        :prompt="t('organization.logo.replace')"
        :error="form.errors.logo"
        @change="onFile"
      />

      <BaseCheckbox
        v-if="currentLogoUrl && !form.logo"
        id="removeLogo"
        v-model="form.removeLogo"
        :label="t('organization.logo.remove')"
      />

      <div v-if="form.logo" class="flex items-center justify-between gap-3">
        <span class="truncate text-body-sm text-text-secondary">{{ form.logo.name }}</span>
        <BaseButton variant="secondary" size="sm" @click="cancelNewLogo">
          <template #icon><X :size="16" aria-hidden="true" /></template>
          {{ t('organization.logo.cancel') }}
        </BaseButton>
      </div>
    </div>
  </div>
</template>
