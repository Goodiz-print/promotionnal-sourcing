export interface CanvasState {
  ctx: CanvasRenderingContext2D
  w: number
  h: number
}

export interface AnimController {
  start: () => void
  stop: () => void
}

/**
 * Écouteurs `resize` posés par une animation pendant sa création : regroupés
 * pour être retirés d'un coup au démontage du canvas, sinon ils
 * s'accumuleraient à chaque navigation Inertia vers la landing.
 */
let currentScope: (() => void)[] | null = null

export function onResize(handler: () => void): void {
  window.addEventListener('resize', handler, { passive: true })
  currentScope?.push(() => window.removeEventListener('resize', handler))
}

/** Crée une animation et renvoie, avec elle, la fonction qui détache ses écouteurs. */
export function createAnimation(factory: () => AnimController | null): {
  controller: AnimController | null
  dispose: () => void
} {
  const scope: (() => void)[] = []
  currentScope = scope
  try {
    return { controller: factory(), dispose: () => scope.forEach((dispose) => dispose()) }
  } finally {
    currentScope = null
  }
}

export function fitCanvas(canvas: HTMLCanvasElement): CanvasState {
  const ctx = canvas.getContext('2d')!
  const state: CanvasState = { ctx, w: 1, h: 1 }
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const rect = canvas.getBoundingClientRect()
    state.w = Math.max(1, rect.width)
    state.h = Math.max(1, rect.height)
    canvas.width = Math.round(state.w * dpr)
    canvas.height = Math.round(state.h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  resize()
  onResize(resize)
  return state
}

// Runs `draw` via requestAnimationFrame only while started — lets each anim
// pause when its canvas scrolls off-screen instead of burning CPU/battery forever.
export function loopController(draw: (now: number) => void): AnimController {
  let rafId = 0
  const tick = (now: number) => {
    draw(now)
    rafId = requestAnimationFrame(tick)
  }
  return {
    start: () => {
      if (rafId) return
      rafId = requestAnimationFrame(tick)
    },
    stop: () => {
      cancelAnimationFrame(rafId)
      rafId = 0
    },
  }
}
