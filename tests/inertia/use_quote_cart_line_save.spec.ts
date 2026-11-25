import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useQuoteCartLineSave } from '~/composables/use_quote_cart_line_save'

describe('useQuoteCartLineSave', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('enregistre après la pause de saisie, pas avant', () => {
    const save = vi.fn()
    const { schedule } = useQuoteCartLineSave(save, 600)

    schedule({ quantity: 300 })
    vi.advanceTimersByTime(599)
    expect(save).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(save).toHaveBeenCalledWith({ quantity: 300 })
  })

  it('fusionne les changements en attente, le dernier mot à chaque champ', () => {
    const save = vi.fn()
    const { schedule } = useQuoteCartLineSave(save, 600)

    schedule({ quantity: 300 })
    schedule({ note: 'Logo' })
    schedule({ quantity: 500 })
    vi.runAllTimers()

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith({ quantity: 500, note: 'Logo' })
  })

  it('enregistre aussitôt avec saveNow, en emportant ce qui attendait', () => {
    const save = vi.fn()
    const { schedule, saveNow } = useQuoteCartLineSave(save, 600)

    schedule({ quantity: 300 })
    saveNow({ variantId: 12 })
    vi.runAllTimers()

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith({ quantity: 300, variantId: 12 })
  })

  it("flush enregistre l'attente ; sans attente, il ne fait rien", () => {
    const save = vi.fn()
    const { schedule, flush } = useQuoteCartLineSave(save, 600)

    flush()
    expect(save).not.toHaveBeenCalled()
    schedule({ note: 'Brodé' })
    flush()
    vi.runAllTimers()

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith({ note: 'Brodé' })
  })

  it("cancel abandonne l'attente", () => {
    const save = vi.fn()
    const { schedule, cancel, flush } = useQuoteCartLineSave(save, 600)

    schedule({ quantity: 300 })
    cancel()
    vi.runAllTimers()
    flush()

    expect(save).not.toHaveBeenCalled()
  })
})
