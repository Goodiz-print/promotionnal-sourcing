import vine from '@vinejs/vine'
import { RFQ_PROGRESSES } from '#shared/types/rfq'

/**
 * Ligne de besoin (fabrique : un nœud VineJS neuf par appel, comme
 * `localizedContent` dans `supplier_product.ts`).
 *
 * `categoryId` et `productId` sont facultatifs et indépendants : besoin libre,
 * cadré par une catégorie, ou pointant un produit du catalogue. `name` reste
 * requis dans les trois cas — c'est lui qui survit à la suppression du produit.
 */
const rfqItem = () =>
  vine.object({
    name: vine.string().minLength(2).maxLength(180).trim(),
    description: vine.string().maxLength(2000).trim().optional().nullable(),
    quantity: vine.number().positive(),
    unit: vine.string().maxLength(32).trim().optional().nullable(),
    categoryId: vine.number().positive().optional().nullable(),
    productId: vine.number().positive().optional().nullable(),
    specs: vine.record(vine.string().maxLength(255)).optional().nullable(),
  })

/**
 * Formulaire de demande (création **et** mise à jour d'un brouillon) : le
 * besoin part toujours avec au moins une ligne, sans quoi il n'est pas
 * chiffrable — `RfqService#publish` le refuserait de toute façon.
 */
export const rfqValidator = vine.create({
  title: vine.string().minLength(3).maxLength(180).trim(),
  description: vine.string().maxLength(5000).trim().optional().nullable(),
  deadline: vine.string().optional().nullable(),
  budgetMax: vine.number().positive().optional().nullable(),
  items: vine.array(rfqItem()).minLength(1).maxLength(50),
  // Destinataires cochés à la création (facultatif : on peut préparer un
  // brouillon puis choisir les fournisseurs depuis l'écran de détail).
  supplierOrganizationIds: vine.array(vine.number().positive()).maxLength(50).optional(),
})

/**
 * Ajout de destinataires (écran de création, puis élargissement d'une demande
 * publiée). L'éligibilité (organisation fournisseuse et active) est vérifiée
 * par le service, qui seul connaît la règle.
 */
export const rfqSuppliersValidator = vine.create({
  supplierOrganizationIds: vine.array(vine.number().positive()).minLength(1).maxLength(50),
})

/**
 * Ajout d'un produit du catalogue à un brouillon existant (fiche produit).
 * Seul l'identifiant voyage : nom, catégorie, quantité et fournisseur sont
 * relus côté serveur depuis le catalogue, jamais crus sur parole.
 */
export const rfqProductValidator = vine.create({
  productId: vine.number().positive(),
})

/**
 * Paramètres de requête des écrans de demande : `productId` (pré-remplissage
 * depuis une fiche) et `productSearch` (sélecteur de produit). Lus depuis la
 * query string, donc potentiellement tout et n'importe quoi (`12abc`, tableau).
 */
export const rfqLookupQueryValidator = vine.create({
  productId: vine.number().positive().optional(),
  productSearch: vine.string().trim().maxLength(100).optional(),
})

/**
 * Filtres de « Mes demandes » (#228), lus dans la query string. Un validateur
 * par filtre : le controller ignore une valeur invalide sans perdre l'autre
 * filtre, plutôt que de la refuser (c'est une URL, pas une saisie).
 */
export const rfqListStatusValidator = vine.create({
  status: vine.enum(RFQ_PROGRESSES).optional(),
})

export const rfqListAuthorValidator = vine.create({
  authorId: vine.number().positive().withoutDecimals().optional(),
})

/**
 * Prolongation d'échéance : une date `AAAA-MM-JJ` (champ `<input type="date">`).
 * L'ordre par rapport à l'échéance actuelle est vérifié par le service.
 */
export const rfqDeadlineValidator = vine.create({
  deadline: vine.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})
