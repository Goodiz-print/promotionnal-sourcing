<script setup lang="ts">
import { ref, watch } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { useConfirmHost } from '~/composables/use_confirm'
import BaseConfirmDialog from '~/components/base/base_confirm_dialog.vue'
import type { ConfirmOptions } from '~/types/ui'

/**
 * Rend la demande de `useConfirm` (une par application, posée dans les layouts).
 * Les derniers textes restent affichés pendant la fermeture ; une navigation
 * annule la demande en cours.
 */
const { t } = useI18n()
const page = usePage()
const { request, accept, cancel } = useConfirmHost()

const shown = ref<ConfirmOptions>({ message: '' })

watch(request, (options) => {
  if (options) shown.value = options
})
watch(() => page.url, cancel)
</script>

<template>
  <BaseConfirmDialog
    :open="request !== null"
    :title="shown.title ?? t('common.confirmDialog.title')"
    :message="shown.message"
    :confirm-label="shown.confirmLabel ?? t('common.confirmDialog.confirm')"
    :cancel-label="shown.cancelLabel ?? t('common.confirmDialog.cancel')"
    :tone="shown.tone"
    @confirm="accept"
    @cancel="cancel"
  />
</template>
