import type Quote from '#models/quote'

/** Devis submitted — voir `QuoteService`. */
export default class QuoteSubmitted {
  constructor(public quote: Quote) {}
}
