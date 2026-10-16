import { fitCanvas, loopController, onResize, type AnimController } from './core'

// Supplier constellation — drifting nodes joined by proximity links.
export function animNodes(canvas: HTMLCanvasElement): AnimController {
  const state = fitCanvas(canvas)
  const COUNT = 30
  let nodes: { x: number; y: number; vx: number; vy: number; r: number; pulse: boolean }[] = []
  const seed = () => {
    nodes = Array.from({ length: COUNT }, () => ({
      x: Math.random() * state.w,
      y: Math.random() * state.h,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      r: 1.1 + Math.random() * 1.7,
      pulse: Math.random() < 0.18,
    }))
  }
  seed()
  onResize(seed)

  return loopController(() => {
    const { ctx, w, h } = state
    ctx.clearRect(0, 0, w, h)
    for (const n of nodes) {
      n.x += n.vx
      n.y += n.vy
      if (n.x < 2 || n.x > w - 2) n.vx *= -1
      if (n.y < 2 || n.y > h - 2) n.vy *= -1
    }
    const MAX = Math.min(96, w * 0.42)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]
        const b = nodes[j]
        const dx = a.x - b.x
        const dy = a.y - b.y
        const d = Math.hypot(dx, dy)
        if (d < MAX) {
          ctx.globalAlpha = (1 - d / MAX) * 0.45
          ctx.strokeStyle = 'rgba(150,124,255,1)'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
        }
      }
    }
    for (const n of nodes) {
      ctx.globalAlpha = 1
      if (n.pulse) {
        ctx.fillStyle = 'rgba(129,180,255,0.9)'
        ctx.shadowColor = 'rgba(129,180,255,0.9)'
        ctx.shadowBlur = 8
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.88)'
        ctx.shadowBlur = 0
      }
      ctx.beginPath()
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
    }
    ctx.globalAlpha = 1
  })
}

// Soft particle field drifting behind the AI drop zone.
export function animScan(canvas: HTMLCanvasElement): AnimController {
  const state = fitCanvas(canvas)
  const COUNT = 34
  let ps: { x: number; y: number; vy: number; r: number; a: number }[] = []
  const seed = () => {
    ps = Array.from({ length: COUNT }, () => ({
      x: Math.random() * state.w,
      y: Math.random() * state.h,
      vy: -(0.15 + Math.random() * 0.4),
      r: 0.6 + Math.random() * 1.6,
      a: 0.2 + Math.random() * 0.5,
    }))
  }
  seed()
  onResize(seed)

  return loopController(() => {
    const { ctx, w, h } = state
    ctx.clearRect(0, 0, w, h)
    for (const p of ps) {
      p.y += p.vy
      if (p.y < -2) {
        p.y = h + 2
        p.x = Math.random() * w
      }
      ctx.globalAlpha = p.a
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  })
}

// Ambient drifting dot field with a slow-roaming soft glow — backdrop for the search card.
export function animSearchField(canvas: HTMLCanvasElement): AnimController {
  const state = fitCanvas(canvas)
  const COUNT = 46
  let dots: { x: number; y: number; vx: number; vy: number; r: number; a: number }[] = []
  const seed = () => {
    dots = Array.from({ length: COUNT }, () => ({
      x: Math.random() * state.w,
      y: Math.random() * state.h,
      vx: (Math.random() - 0.5) * 0.05,
      vy: (Math.random() - 0.5) * 0.05,
      r: 0.6 + Math.random() * 1.3,
      a: 0.08 + Math.random() * 0.16,
    }))
  }
  seed()
  onResize(seed)

  const t0 = performance.now()

  return loopController((now) => {
    const { ctx, w, h } = state
    const t = (now - t0) * 0.001
    ctx.clearRect(0, 0, w, h)

    const gx = w * (0.5 + 0.36 * Math.sin(t * 0.22))
    const gy = h * (0.5 + 0.36 * Math.cos(t * 0.17))
    const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(w, h) * 0.6)
    glow.addColorStop(0, 'rgba(64,50,200,0.10)')
    glow.addColorStop(1, 'rgba(64,50,200,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, w, h)

    for (const d of dots) {
      d.x += d.vx
      d.y += d.vy
      if (d.x < -2) d.x = w + 2
      if (d.x > w + 2) d.x = -2
      if (d.y < -2) d.y = h + 2
      if (d.y > h + 2) d.y = -2
      ctx.globalAlpha = d.a
      ctx.fillStyle = 'rgba(64,50,200,0.9)'
      ctx.beginPath()
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  })
}
