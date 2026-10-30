import { onBeforeUnmount, onMounted } from 'vue'
import { useI18n } from '~/i18n'

function animateCount(el: Element, locale: string, instant = false) {
  const target = Number.parseInt(el.getAttribute('data-count-to') || '0', 10)
  const suffix = el.getAttribute('data-count-suffix') || ''
  const format = (n: number) => n.toLocaleString(locale) + suffix

  if (instant) {
    el.textContent = format(target)
    return
  }

  const duration = 1400
  const start = performance.now()
  const step = (now: number) => {
    const progress = Math.min(1, (now - start) / duration)
    const eased = 1 - Math.pow(1 - progress, 3)
    el.textContent = format(Math.round(target * eased))
    if (progress < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

/**
 * Effets de défilement de la landing : apparition (`[data-reveal]`), pop-in
 * (`[data-pop]`), compteurs (`[data-count-to]` dans un bloc révélé) et fond du
 * header une fois la page défilée (`[data-nav]`).
 *
 * `scan()` observe les éléments pas encore révélés : à rappeler après chaque
 * navigation, car le layout marketing reste monté d'une page à l'autre.
 */
export function useScrollFx() {
  const { locale } = useI18n()
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let revealIo: IntersectionObserver | null = null
  let popIo: IntersectionObserver | null = null
  let onScroll: (() => void) | null = null

  function reveal(el: Element, instant: boolean) {
    el.classList.add('is-visible')
    el.querySelectorAll('[data-count-to]').forEach((count) =>
      animateCount(count, locale.value, instant)
    )
  }

  function scan() {
    const revealEls = document.querySelectorAll('[data-reveal]:not(.is-visible)')
    const popEls = document.querySelectorAll('[data-pop]:not(.is-visible)')

    if (reduced() || !('IntersectionObserver' in window)) {
      revealEls.forEach((el) => reveal(el, true))
      popEls.forEach((el) => el.classList.add('is-visible'))
      return
    }

    revealIo ??= new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          reveal(entry.target, false)
          revealIo?.unobserve(entry.target)
        }
      },
      { threshold: 0.12 }
    )
    popIo ??= new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-visible')
          popIo?.unobserve(entry.target)
        }
      },
      { threshold: 0.4 }
    )
    revealEls.forEach((el) => revealIo?.observe(el))
    popEls.forEach((el) => popIo?.observe(el))
  }

  onMounted(() => {
    scan()

    const nav = document.querySelector('[data-nav]')
    if (nav) {
      onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 32)
      window.addEventListener('scroll', onScroll, { passive: true })
      onScroll()
    }
  })

  onBeforeUnmount(() => {
    revealIo?.disconnect()
    popIo?.disconnect()
    if (onScroll) window.removeEventListener('scroll', onScroll)
  })

  return { scan }
}
