<script setup lang="ts">
import { nextTick, watch } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { toast, Toaster } from 'vue-sonner'
import MarketingFooter from '~/components/marketing/marketing_footer.vue'
import MarketingHeader from '~/components/marketing/marketing_header.vue'
import { useScrollFx } from '~/composables/use_scroll_fx'

const page = usePage()
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
</template>
