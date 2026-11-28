/**
 * Compte fournisseur fictif du staging : un utilisateur `owner` d'une
 * organisation fournisseur, qui porte une fiche importée par `supplier:import`
 * (identifiée par son slug de connecteur). Sans ce rattachement, la fiche n'est
 * pas publiée (#240).
 */
export interface StagingSupplierAccount {
  email: string
  firstName: string
  orgSlug: string
  orgName: string
  supplierSlug: string
}

/** Compte agence fictif du staging : `owner` de sa propre organisation acheteuse. */
export interface StagingAgencyAccount {
  email: string
  firstName: string
  orgSlug: string
  orgName: string
}

/** Ce que les comptes `owner` du staging ont en commun (fournisseurs et agences). */
export type StagingOwnerAccount = StagingSupplierAccount | StagingAgencyAccount

/** Données partagées par les comptes créés par `StagingAccountSeeder`. */
export interface StagingAccountContext {
  password: string
  ownerRoleId: number
  /** Auteur du rattachement des fiches importées : le premier admin seedé. */
  linkedByUserId: number
}
