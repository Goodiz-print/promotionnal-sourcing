/**
 * Fuseau unique de la plateforme (marché France ; aucun fuseau n'est stocké
 * par utilisateur). Toute règle ou tout affichage lié au calendrier en dérive :
 * échéance des demandes (`RFQ_DEADLINE_TIMEZONE`), périodes d'abonnement
 * (`SUBSCRIPTION_TIMEZONE`) et affichage des dates et heures
 * (`shared/helpers/date.ts`). Un fuseau explicite rend aussi le rendu SSR
 * (serveur en `TZ=UTC`) et le rendu navigateur (fuseau de l'appareil)
 * identiques, sans saut à l'hydratation (#289).
 */
export const PLATFORM_TIMEZONE = 'Europe/Paris'
