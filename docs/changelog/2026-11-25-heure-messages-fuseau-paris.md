# Heure des messages identique côté agence et fournisseur

> Date : 2026-11-25

Correction de l'issue #289 : un même message du fil d'échanges s'affichait à
01:51 côté agence et 09:51 côté fournisseur. `formatDateTime` appelait
`toLocaleString` sans fuseau : le rendu SSR suivait le fuseau du serveur
(`TZ=UTC`), le navigateur celui de l'appareil, et le texte affiché dépendait
de l'écran (rendu serveur seul ou après hydratation).

- `formatDateTime` quitte `inertia/components/orders/types.ts` pour
  `shared/helpers/date.ts` et formate dans un fuseau explicite,
  `DISPLAY_TIMEZONE` (`Europe/Paris`, `shared/types/date.ts`) — aucun fuseau
  n'est stocké par utilisateur.
- `formatShortDate` (même fichier) suit le même fuseau : le jour affiché ne
  change plus selon le fuseau d'exécution autour de minuit.
- Appelants mis à jour : fil de messages (`conversation_message.vue`), frise de
  commande (`order_timeline.vue`), `use_trade_format`, `use_ad_format`.
- Tests : `tests/unit/date.spec.ts` (heure d'hiver, heure d'été, langue,
  changement de jour à minuit UTC), verts quel que soit le `TZ` du processus.
