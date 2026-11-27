/** Marque déjà portée par les titres de la landing. */
const BRAND = 'Promotional Sourcing'

/**
 * Titre de l'onglet : `<titre> - <application>`, le nom seul sans titre, et le
 * titre tel quel s'il porte déjà la marque (pas de suffixe en double).
 */
export function pageTitle(title: string, appName: string): string {
  if (!title) return appName
  if (title.includes(BRAND)) return title
  return `${title} - ${appName}`
}
