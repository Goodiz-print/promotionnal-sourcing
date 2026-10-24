<script setup lang="ts">
import { router } from '@inertiajs/vue3'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseButton from '~/components/base/base_button.vue'
import type { RfqDetailType } from '#shared/types/rfq'

/**
 * Transitions pilotables depuis l'écran de détail. Chaque bouton n'apparaît
 * que lorsque la transition est possible — le service reste seul juge et
 * répond par un message flash si l'état a changé entre-temps.
 */
const props = defineProps<{ rfq: RfqDetailType }>()

const { t, locale } = useI18n()

/** Publier n'a de sens qu'avec un besoin décrit. */
const canPublish = () => props.rfq.status === 'draft' && props.rfq.itemCount > 0
/** Envoyer suppose une demande publiée et au moins un destinataire à notifier. */
const canSend = () =>
  props.rfq.status === 'published' && props.rfq.suppliers.some((row) => row.status === 'pending')
const canClose = () => props.rfq.status === 'published'
/** Seul un brouillon se supprime ; une demande publiée se clôture. */
const canDelete = () => props.rfq.status === 'draft'

function post(route: 'rfqs.publish' | 'rfqs.send' | 'rfqs.close') {
  router.post(
    urlFor(route, { locale: locale.value, id: props.rfq.id }),
    {},
    { preserveScroll: true }
  )
}

function destroy() {
  if (!window.confirm(t('rfq.actions.confirmDelete'))) return
  router.delete(urlFor('rfqs.destroy', { locale: locale.value, id: props.rfq.id }))
}

function close() {
  if (!window.confirm(t('rfq.actions.confirmClose'))) return
  post('rfqs.close')
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <BaseButton v-if="canPublish()" variant="secondary" @click="post('rfqs.publish')">
      {{ t('rfq.actions.publish') }}
    </BaseButton>
    <BaseButton v-if="canSend()" variant="secondary" @click="post('rfqs.send')">
      {{ t('rfq.actions.send') }}
    </BaseButton>
    <BaseButton v-if="canClose()" variant="danger" @click="close()">
      {{ t('rfq.actions.close') }}
    </BaseButton>
    <BaseButton v-if="canDelete()" variant="danger" @click="destroy()">
      {{ t('rfq.actions.delete') }}
    </BaseButton>
  </div>
</template>
