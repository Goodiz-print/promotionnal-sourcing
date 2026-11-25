<script setup lang="ts">
import { nextTick, watch } from 'vue'
import { usePage } from '@inertiajs/vue3'
import type { Data } from '@generated/data'
import { toast, Toaster } from 'vue-sonner'
import MarketingFooter from '~/components/marketing/marketing_footer.vue'
import MarketingHeader from '~/components/marketing/marketing_header.vue'
import ConfirmDialogHost from '~/components/app/confirm_dialog_host.vue'
import { useScrollFx } from '~/composables/use_scroll_fx'

const page = usePage<Data.SharedProps>()
const { scan } = useScrollFx()

/* Le layout reste monté d'une page de la landing à l'autre : les nouveaux blocs
   [data-reveal] doivent être observés après chaque navigation. */
watch(
  () => page.url,
  async () => {
    toast.dismiss()
    await nextTick()
    scan()
  }
)

/* Erreurs renvoyées par le serveur (ex. trop d'envois du formulaire de contact). */
watch(
  () => page.props.flash,
  (flashMessages) => {
    if (flashMessages?.error) toast.error(flashMessages.error)
  },
  { immediate: true }
)
</script>

<template>
  <div class="marketing overflow-x-hidden">
    <MarketingHeader />
    <main>
      <slot />
    </main>
    <MarketingFooter />
  </div>
  <Toaster position="top-center" rich-colors />
  <ConfirmDialogHost />
</template>
