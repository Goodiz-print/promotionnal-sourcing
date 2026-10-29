<script setup lang="ts">
/**
 * Groupe de la barre de filtres : séparateur hairline + titre de groupe en
 * eyebrow. `fieldset` (cases à cocher, titre en légende) par défaut ; `section`
 * (titre `h3`) pour un bloc composé de plusieurs sous-groupes. Le séparateur est
 * porté par un `div` enveloppant : un `fieldset` bordé rendrait sa légende dans
 * la bordure.
 */
withDefaults(
  defineProps<{
    title: string
    as?: 'fieldset' | 'section'
  }>(),
  { as: 'fieldset' }
)
</script>

<template>
  <div class="border-t border-hairline pt-5">
    <fieldset v-if="as === 'fieldset'" class="flex flex-col gap-2">
      <legend class="pb-2 text-eyebrow text-text-muted">{{ title }}</legend>
      <slot />
    </fieldset>
    <section v-else class="flex flex-col gap-3">
      <h3 class="text-eyebrow text-text-muted">{{ title }}</h3>
      <slot />
    </section>
  </div>
</template>
