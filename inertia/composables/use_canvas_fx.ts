import { onBeforeUnmount, onMounted, type Ref } from 'vue'
import { createAnimation, type AnimController } from './canvas_fx/core'
import { animChart } from './canvas_fx/chart'
import { animGlobe } from './canvas_fx/globe'
import { animNodes, animScan, animSearchField } from './canvas_fx/particles'

export type CanvasFxKind = 'nodes' | 'scan' | 'chart' | 'globe' | 'search-field'

const ANIMATIONS: Record<CanvasFxKind, (canvas: HTMLCanvasElement) => AnimController | null> = {
  'nodes': animNodes,
  'scan': animScan,
  'chart': animChart,
  'globe': animGlobe,
  'search-field': animSearchField,
}

/**
 * Anime un `<canvas>`. La boucle ne tourne que lorsque le canvas est (presque)
 * à l'écran, et rien ne démarre si l'utilisateur préfère réduire les
 * animations. Exécuté côté client uniquement (`onMounted`), donc sans effet
 * pendant le SSR.
 */
export function useCanvasFx(canvas: Ref<HTMLCanvasElement | null>, kind: CanvasFxKind) {
  let observer: IntersectionObserver | null = null
  let controller: AnimController | null = null
  let dispose: (() => void) | null = null

  onMounted(() => {
    const element = canvas.value
    if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const created = createAnimation(() => ANIMATIONS[kind](element))
    controller = created.controller
    dispose = created.dispose
    if (!controller) return

    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) controller?.start()
          else controller?.stop()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(element)
  })

  onBeforeUnmount(() => {
    observer?.disconnect()
    controller?.stop()
    dispose?.()
  })
}
