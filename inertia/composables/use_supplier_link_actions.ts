import { ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'
import { useConfirm } from '~/composables/use_confirm'
import type { ConfirmOptions } from '~/types/ui'

/**
 * Rattachement / détachement d'une fiche fournisseur (#231) : visites Inertia
 * (`preserveScroll`), le serveur répond par une redirection + flash.
 * `processing` désactive les boutons pendant la requête ; le détachement
 * demande confirmation (il retire le catalogue du site).
 */
export function useSupplierLinkActions(supplierId: number) {
  const { locale } = useI18n()
  const { confirm } = useConfirm()

  const processing = ref(false)

  const visitOptions = {
    preserveScroll: true,
    onStart: () => (processing.value = true),
    onFinish: () => (processing.value = false),
  }

  const url = (name: 'link' | 'unlink') =>
    urlFor(`admin.supplier_links.${name}`, { locale: locale.value, id: supplierId })

  function link(organizationId: number) {
    router.post(url('link'), { organizationId }, visitOptions)
  }

  async function unlink(confirmation: ConfirmOptions) {
    if (!(await confirm(confirmation))) return
    router.delete(url('unlink'), visitOptions)
  }

  return { processing, link, unlink }
}
