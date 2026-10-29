<script setup lang="ts">
/** Halo de fond indigo / ambre. `animated` ajoute la dérive lente de la landing. */
withDefaults(defineProps<{ animated?: boolean }>(), { animated: false })
</script>

<template>
  <div
    aria-hidden="true"
    class="pointer-events-none absolute inset-[-10%] z-0"
    :class="animated ? 'anim-mesh' : ''"
    style="
      background:
        radial-gradient(480px 320px at 18% 20%, rgba(64, 50, 200, 0.16), transparent 60%),
        radial-gradient(520px 360px at 82% 10%, rgba(246, 166, 35, 0.1), transparent 60%),
        radial-gradient(600px 400px at 50% 0%, rgba(64, 50, 200, 0.07), transparent 65%);
    "
  />
</template>
