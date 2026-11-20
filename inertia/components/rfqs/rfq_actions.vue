<script setup lang="ts">
import { router } from '@inertiajs/vue3'
import { Lock, Megaphone, Send, Trash2 } from 'lucide-vue-next'
import { useI18n } from '~/i18n'
import { urlFor } from '~/client'
import BaseButton from '~/components/base/base_button.vue'
import { ICON_SIZE } from '~/types/ui'
import type { RfqDetailType } from '#shared/types/rfq'

/**
 * Transitions pilotables depuis l'en-tête de l'écran de détail. Chaque bouton
 * n'apparaît que lorsque la transition est possible — le service reste seul
 * juge et répond par un message flash si l'état a changé entre-temps.
 * Publier et envoyer font avancer la demande : ce sont les actions primaires ;
 * clôturer et supprimer sont irréversibles, donc en `danger`.
 *
 * `canClose` : clôturer est une décision, réservée aux responsables
 * (`canManageRfq`) ; publier, envoyer et supprimer un brouillon sont ouverts à
 * tout membre qui peut envoyer une demande (`canSendRfq`, #216).
 */
const props = defineProps<{ rfq: RfqDetailType; canClose: boolean }>()

const { t, locale } = useI18n()

/** Publier n'a de sens qu'avec un besoin décrit. */
const canPublish = () => props.rfq.status === 'draft' && props.rfq.itemCount > 0
/** Envoyer suppose une demande publiée et au moins un destinataire à notifier. */
const canSend = () =>
  props.rfq.status === 'published' && props.rfq.suppliers.some((row) => row.status === 'pending')
const isClosable = () => props.canClose && props.rfq.status === 'published'
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
    <BaseButton v-if="canDelete()" variant="danger" @click="destroy()">
      <template #icon><Trash2 :size="ICON_SIZE" aria-hidden="true" /></template>
      {{ t('rfq.actions.delete') }}
    </BaseButton>
    <BaseButton v-if="isClosable()" variant="danger" @click="close()">
      <template #icon><Lock :size="ICON_SIZE" aria-hidden="true" /></template>
      {{ t('rfq.actions.close') }}
    </BaseButton>
    <BaseButton v-if="canPublish()" @click="post('rfqs.publish')">
      <template #icon><Megaphone :size="ICON_SIZE" aria-hidden="true" /></template>
      {{ t('rfq.actions.publish') }}
    </BaseButton>
    <BaseButton v-if="canSend()" @click="post('rfqs.send')">
      <template #icon><Send :size="ICON_SIZE" aria-hidden="true" /></template>
      {{ t('rfq.actions.send') }}
    </BaseButton>
  </div>
</template>
