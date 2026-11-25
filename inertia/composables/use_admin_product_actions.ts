import { ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'
import { useConfirm } from '~/composables/use_confirm'
import type { ConfirmOptions } from '~/types/ui'
import type { AdminProductAction } from '#shared/types/admin_product'

/**
 * Actions d'administration d'un produit (#164) : chaque mutation est une visite
 * Inertia en POST (`preserveScroll`), le serveur répond par une redirection + flash.
 * `processing` désactive les boutons pendant la requête. Une action avec
 * `confirmation` demande confirmation (`useConfirm`) ; refusée, aucune requête ne part.
 */
export function useAdminProductActions(productId: number) {
  const { locale } = useI18n()
  const { confirm } = useConfirm()

  const processing = ref(false)

  const visitOptions = {
    preserveScroll: true,
    onStart: () => (processing.value = true),
    onFinish: () => (processing.value = false),
  }

  async function run(
    action: AdminProductAction,
    confirmation?: ConfirmOptions,
    data: { reason?: string } = {}
  ) {
    if (confirmation && !(await confirm(confirmation))) return
    router.post(
      urlFor(`admin.products.${action}`, { locale: locale.value, id: productId }),
      data,
      visitOptions
    )
  }

  return { processing, run }
}
