import db from '@adonisjs/lucid/services/db'

/**
 * Slugs des attributs **filtrables** dérivés de la base (écart 6 du plan
 * d'extension) : ceux dont au moins une ligne `category_attributes.is_filter`
 * vaut `true`. C'est cette liste — jamais une constante codée en dur — qui
 * alimente les `filterableAttributes` de l'index de recherche (un champ
 * `attributes.<slug>` par attribut filtrable) et les `facets` demandés pour
 * obtenir les distributions.
 *
 * N'importe **aucun modèle Lucid** (requête `db` brute) : le pilote Meilisearch
 * l'injecte pour appliquer les réglages de l'index, et doit rester utilisable
 * sans dépendre du graphe des modèles.
 */
export default class FilterableFacetsService {
  /**
   * Slugs d'attributs marqués `is_filter` dans au moins une catégorie, triés —
   * stable d'un appel à l'autre. Un changement de `is_filter` est pris en compte
   * au prochain `search:reindex` (les réglages de l'index y sont réappliqués).
   */
  async filterableSlugs(): Promise<string[]> {
    const rows = await db
      .from('category_attributes')
      .join('attributes', 'attributes.id', 'category_attributes.attribute_id')
      .where('category_attributes.is_filter', true)
      .distinct('attributes.slug')
      .orderBy('attributes.slug', 'asc')

    return rows.map((row: { slug: string }) => row.slug)
  }
}
