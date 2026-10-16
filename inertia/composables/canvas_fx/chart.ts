import { fitCanvas, loopController, type AnimController } from './core'

// Live 3-line price chart — three suppliers wandering at different levels.
export function animChart(canvas: HTMLCanvasElement): AnimController {
  const state = fitCanvas(canvas)
  const lines = [
    { base: 0.72, amp: 0.05, sp: 0.5, ph: 0.0, color: 'rgba(64,50,200,1)', w: 2 },
    { base: 0.48, amp: 0.06, sp: 0.7, ph: 1.7, color: 'rgba(170,178,205,1)', w: 1.5 },
    { base: 0.26, amp: 0.05, sp: 0.6, ph: 3.1, color: 'rgba(205,210,225,1)', w: 1.5 },
  ]
  const N = 48
  const t0 = performance.now()

  return loopController((now) => {
    const { ctx, w, h } = state
    const t = (now - t0) * 0.001
    ctx.clearRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(0,0,0,0.05)'
    ctx.lineWidth = 1
    for (let g = 1; g <= 3; g++) {
      const y = (h / 4) * g
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }
    for (const ln of lines) {
      ctx.beginPath()
      for (let i = 0; i <= N; i++) {
        const u = i / N
        const v =
          ln.base +
          ln.amp * Math.sin(u * 6.2 + t * ln.sp + ln.ph) +
          ln.amp * 0.5 * Math.sin(u * 13 + t * ln.sp * 1.6)
        const x = u * w
        const y = h - v * h
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = ln.color
      ctx.lineWidth = ln.w
      ctx.lineJoin = 'round'
      ctx.stroke()
      const uv =
        ln.base +
        ln.amp * Math.sin(6.2 + t * ln.sp + ln.ph) +
        ln.amp * 0.5 * Math.sin(13 + t * ln.sp * 1.6)
      ctx.fillStyle = ln.color
      ctx.beginPath()
      ctx.arc(w - 1, h - uv * h, ln.w + 1, 0, Math.PI * 2)
      ctx.fill()
    }
  })
}
