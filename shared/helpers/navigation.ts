/**
 * Un lien de menu est actif quand l'URL courante est exactement sa cible ou une
 * page enfant (`/fr/rfqs` couvre `/fr/rfqs/12`). La query string et l'ancre de
 * l'URL courante sont ignorées.
 */
export function isActivePath(currentUrl: string, href: string): boolean {
  const path = currentUrl.split(/[?#]/)[0]
  return path === href || path.startsWith(`${href}/`)
}
