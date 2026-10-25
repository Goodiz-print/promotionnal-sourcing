import type Rfq from '#models/rfq'

/** Un fournisseur a décliné la consultation — voir `RfqService#decline`. */
export default class RfqDeclined {
  constructor(
    public rfq: Rfq,
    public supplierOrganizationId: number
  ) {}
}
