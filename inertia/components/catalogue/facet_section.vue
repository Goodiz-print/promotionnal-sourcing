<script setup lang="ts">
import { ref, useId } from 'vue'
import { ChevronDown } from 'lucide-vue-next'

/**
 * Groupe rétractable de la barre de filtres : séparateur hairline + en-tête
 * cliquable (titre en eyebrow + chevron). `fieldset` (cases à cocher) par défaut ;
 * `section` pour un bloc composé de plusieurs sous-groupes. Le titre est porté par
 * le bouton (`aria-expanded` / `aria-controls`) ; le corps reste dans le DOM
 * (`v-show`) pour conserver l'état des cases quand le groupe est replié.
 */
const props = withDefaults(
  defineProps<{
    title: string
    as?: 'fieldset' | 'section'
    // Ouvert au premier rendu ; l'état est ensuite local au groupe.
    defaultOpen?: boolean
  }>(),
  { as: 'fieldset', defaultOpen: true }
)

const open = ref(props.defaultOpen)
const bodyId = useId()
</script>

<template>
  <div class="border-t border-hairline pt-5">
    <button
      type="button"
      class="mb-2 flex w-full items-center justify-between gap-2 text-left text-eyebrow text-text-muted"
      :aria-expanded="open"
      :aria-controls="bodyId"
      @click="open = !open"
    >
      <span>{{ title }}</span>
      <ChevronDown
        class="size-4 shrink-0 transition-transform"
        :class="{ '-rotate-90': !open }"
        aria-hidden="true"
      />
    </button>
    <component
      :is="as"
      v-show="open"
      :id="bodyId"
      class="flex min-w-0 flex-col border-0 p-0"
      :class="as === 'fieldset' ? 'gap-2' : 'gap-3'"
      :aria-label="title"
    >
      <slot />
    </component>
  </div>
</template>
