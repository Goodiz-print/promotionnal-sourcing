<script setup lang="ts">
import { ref } from 'vue'
import { useCanvasFx, type CanvasFxKind } from '~/composables/use_canvas_fx'

const props = defineProps<{ kind: CanvasFxKind }>()

const canvas = ref<HTMLCanvasElement | null>(null)
useCanvasFx(canvas, props.kind)
</script>

<template>
  <canvas
    ref="canvas"
    aria-hidden="true"
    class="pointer-events-none absolute inset-0 block h-full w-full"
  />
</template>
