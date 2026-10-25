import type Organization from '#models/organization'
import type Rfq from '#models/rfq'
import type RfqSupplier from '#models/rfq_supplier'

/**
 * Une demande de devis vient d'être diffusée : `recipients` ne contient que les
 * lignes réellement passées en `sent` (voir `RfqService#send`).
 */
export default class RfqSent {
  constructor(
    public rfq: Rfq,
    public buyer: Organization,
    public recipients: RfqSupplier[]
  ) {}
}
