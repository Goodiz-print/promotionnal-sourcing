<script setup lang="ts">
/**
 * Tableau de données : conteneur arrondi + `table-base` (app.css). Slots `head`
 * (`<tr><th scope="col">…`), défaut (`<tr>` du corps) et `foot`. Cellules
 * numériques : `text-tabular text-right`. `bare` retire le cadre (tableau déjà
 * posé dans une `BaseSection flush`).
 */
withDefaults(defineProps<{ caption?: string; bare?: boolean }>(), { caption: '', bare: false })
</script>

<template>
  <div class="overflow-x-auto" :class="bare ? '' : 'rounded-xl border border-hairline bg-card'">
    <table class="table-base">
      <caption v-if="caption" class="sr-only">
        {{
          caption
        }}
      </caption>
      <thead v-if="$slots.head">
        <slot name="head" />
      </thead>
      <tbody>
        <slot />
      </tbody>
      <tfoot v-if="$slots.foot">
        <slot name="foot" />
      </tfoot>
    </table>
  </div>
</template>
