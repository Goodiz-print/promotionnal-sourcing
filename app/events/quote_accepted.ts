import type Quote from '#models/quote'

/** Devis accepted — voir `QuoteService`. */
export default class QuoteAccepted {
  constructor(public quote: Quote) {}
}
