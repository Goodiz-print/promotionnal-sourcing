<script setup lang="ts">
import { inject, computed } from 'vue'
import { useI18n } from '~/i18n'
import BaseFileInput from '~/components/base_file_input.vue'
import BaseCheckbox from '~/components/base_checkbox.vue'
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
  <div class="flex flex-col gap-3">
    <label class="text-sm font-medium">{{ t('organization.fields.logo') }}</label>

    <div class="flex items-center gap-4">
      <img v-if="previewUrl" :src="previewUrl" alt="" class="h-16 w-16 rounded object-cover" />
      <span v-else class="text-sm text-[var(--gray-6)]">{{ t('organization.logo.none') }}</span>

      <BaseCheckbox
        v-if="currentLogoUrl && !form.logo"
        id="removeLogo"
        v-model="form.removeLogo"
        :label="t('organization.logo.remove')"
      />
    </div>

    <div class="flex items-center gap-3">
      <BaseFileInput id="logo" :label="t('organization.logo.replace')" @change="onFile" />
      <button
        v-if="form.logo"
        type="button"
        class="text-sm text-[var(--gray-6)] underline"
        @click="cancelNewLogo"
      >
        {{ t('organization.logo.cancel') }}
      </button>
    </div>
  </div>
</template>
