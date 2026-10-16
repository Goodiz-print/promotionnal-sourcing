import { loopController, onResize, type AnimController } from './core'

// Rotating fibonacci-sphere globe with travelling arcs — "global commerce" motif.
export function animGlobe(canvas: HTMLCanvasElement): AnimController | null {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  let w = 1
  let h = 1
  let cx = 0
  let cy = 0
  let r = 1
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const rect = canvas.getBoundingClientRect()
    w = Math.max(1, rect.width)
    h = Math.max(1, rect.height)
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    cx = w / 2
    cy = h / 2
    r = Math.min(w, h) * 0.4
  }
  resize()
  onResize(resize)

  const N = 720
  const pts: [number, number, number][] = []
  const inc = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2
    const rad = Math.sqrt(Math.max(0, 1 - y * y))
    const phi = i * inc
    pts.push([Math.cos(phi) * rad, y, Math.sin(phi) * rad])
  }
  const rndPt = () => pts[(Math.random() * N) | 0]
  // Violet + warm (orange/yellow) hues cycled across arcs so the globe reads multi-hued, not monochrome.
  const ARC_COLORS = ['rgba(160,132,255,', 'rgba(246,166,35,', 'rgba(255,204,0,']
  const arcs = Array.from({ length: 9 }, (_, i) => ({
    a: rndPt(),
    b: rndPt(),
    t: Math.random(),
    sp: 0.15 + Math.random() * 0.3,
    color: ARC_COLORS[i % ARC_COLORS.length],
  }))

  const tilt = -0.42
  const ct = Math.cos(tilt)
  const st = Math.sin(tilt)
  const transform = (
    p: [number, number, number],
    ca: number,
    sa: number
  ): [number, number, number] => {
    const x = p[0] * ca + p[2] * sa
    const z = -p[0] * sa + p[2] * ca
    const y = p[1]
    return [x, y * ct - z * st, y * st + z * ct]
  }
  const project = (p: [number, number, number]): [number, number, number, number] => {
    const persp = 1 + p[2] * 0.16
    return [cx + p[0] * r * persp, cy - p[1] * r * persp, p[2], persp]
  }
  const slerp = (
    a: [number, number, number],
    b: [number, number, number],
    t: number
  ): [number, number, number] => {
    let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
    d = Math.max(-1, Math.min(1, d))
    const th = Math.acos(d)
    if (th < 1e-4) return [...a]
    const s = Math.sin(th)
    const w1 = Math.sin((1 - t) * th) / s
    const w2 = Math.sin(t * th) / s
    return [a[0] * w1 + b[0] * w2, a[1] * w1 + b[1] * w2, a[2] * w1 + b[2] * w2]
  }

  const t0 = performance.now()
  let last = t0

  return loopController((now) => {
    const dt = Math.min(0.05, (now - last) * 0.001)
    last = now
    const ang = (now - t0) * 0.001 * 0.16
    const ca = Math.cos(ang)
    const sa = Math.sin(ang)
    ctx.clearRect(0, 0, w, h)

    const halo = ctx.createRadialGradient(cx, cy, r * 0.25, cx, cy, r * 1.25)
    halo.addColorStop(0, 'rgba(139,110,246,0.30)')
    halo.addColorStop(0.6, 'rgba(246,166,35,0.12)')
    halo.addColorStop(1, 'rgba(139,110,246,0)')
    ctx.fillStyle = halo
    ctx.beginPath()
    ctx.arc(cx, cy, r * 1.25, 0, Math.PI * 2)
    ctx.fill()

    for (let i = 0; i < N; i++) {
      const p = transform(pts[i], ca, sa)
      const pr = project(p)
      const z = pr[2]
      const f = (z + 1) / 2
      ctx.globalAlpha = z > -0.15 ? 0.2 + 0.7 * f : 0.05
      ctx.fillStyle =
        z > 0.25
          ? i % 6 === 0
            ? 'rgba(255,204,102,0.95)'
            : 'rgba(255,255,255,0.92)'
          : 'rgba(196,205,255,0.82)'
      const size = 0.5 + 1.0 * f
      ctx.beginPath()
      ctx.arc(pr[0], pr[1], size, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    const SEG = 44
    for (const arc of arcs) {
      arc.t += arc.sp * dt
      if (arc.t > 1) {
        arc.t = 0
        arc.a = rndPt()
        arc.b = rndPt()
      }
      ctx.beginPath()
      let started = false
      for (let s = 0; s <= SEG; s++) {
        const u = s / SEG
        const m = slerp(arc.a, arc.b, u)
        const bump = 1 + 0.34 * Math.sin(Math.PI * u)
        const p = transform([m[0] * bump, m[1] * bump, m[2] * bump], ca, sa)
        const pr = project(p)
        if (p[2] < -0.25) {
          started = false
          continue
        }
        if (!started) {
          ctx.moveTo(pr[0], pr[1])
          started = true
        } else ctx.lineTo(pr[0], pr[1])
      }
      ctx.strokeStyle = arc.color + '0.30)'
      ctx.lineWidth = 1
      ctx.stroke()

      const md = slerp(arc.a, arc.b, arc.t)
      const bd = 1 + 0.34 * Math.sin(Math.PI * arc.t)
      const pdp = transform([md[0] * bd, md[1] * bd, md[2] * bd], ca, sa)
      const prd = project(pdp)
      if (pdp[2] > -0.25) {
        ctx.fillStyle = '#fff'
        ctx.shadowColor = arc.color + '0.95)'
        ctx.shadowBlur = 9
        ctx.beginPath()
        ctx.arc(prd[0], prd[1], 2.2, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      }
    }
  })
}
