/**
 * Fuseau dans lequel l'interface affiche les dates et heures (#289). Explicite
 * pour que le rendu SSR (fuseau du serveur, `TZ=UTC`) et le rendu navigateur
 * (fuseau de l'appareil) produisent le même texte, sans saut à l'hydratation :
 * l'agence et le fournisseur voient la même heure pour un même message. Aucun
 * fuseau n'est stocké par utilisateur ; le marché visé est la France.
 */
export const DISPLAY_TIMEZONE = 'Europe/Paris'
