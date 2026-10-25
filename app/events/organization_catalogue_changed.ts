/**
 * La visibilité du catalogue d'une organisation a changé (archivage,
 * modération) : tous ses produits sont à resynchroniser dans l'index de
 * recherche (#112).
 */
export default class OrganizationCatalogueChanged {
  constructor(public organizationId: number) {}
}
