import type Quote from '#models/quote'

/** Devis rejected — voir `QuoteService`. */
export default class QuoteRejected {
  constructor(public quote: Quote) {}
}
