<script setup lang="ts">
import { ref, watch } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { useDismissable } from '~/composables/use_dismissable'

/**
 * Menu déroulant : le slot `trigger` reçoit `{ open, toggle }` et rend le bouton
 * (avec `aria-expanded`), le slot par défaut le contenu du panneau. Fermeture au
 * clic extérieur, à Échap et à chaque navigation.
 */
withDefaults(
  defineProps<{
    align?: 'left' | 'right'
    width?: string
  }>(),
  { align: 'right', width: 'w-56' }
)

const emit = defineEmits<{ open: []; close: [] }>()

const root = ref<HTMLElement | null>(null)
const { open, toggle, close } = useDismissable(root)
const page = usePage()

watch(() => page.url, close)
watch(open, (value) => {
  if (value) emit('open')
  else emit('close')
})

defineExpose({ close })
</script>

<template>
  <div ref="root" class="relative">
    <slot name="trigger" :open="open" :toggle="toggle" />
    <div
      v-show="open"
      :class="[align === 'right' ? 'right-0' : 'left-0', width]"
      class="absolute top-full z-40 mt-2 overflow-hidden rounded-lg border border-hairline bg-card p-1 shadow-elevation-2"
    >
      <slot :close="close" />
    </div>
  </div>
</template>
