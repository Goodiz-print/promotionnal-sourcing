# Écrans de modération du back-office

> Date : 2026-11-03

Issue #163 (epic #157) : `ModerationService` et `moderation_decisions` ont maintenant un écran.

- **File** `GET /admin/moderation` : organisations fournisseurs actives et produits actifs, filtrables par type, statut (en attente par défaut, approuvé, rejeté) et ancienneté (7 ou 30 jours), du plus ancien au plus récent.
- **Décision** `POST /admin/moderation/:type/:id/decision` : approuver, ou rejeter avec un motif obligatoire. La décision et l'entrée du journal d'audit (`moderation.approved` / `moderation.rejected`) sont écrites dans la même transaction ; la réindexation du catalogue part après validation. `ModerationService.decide` accepte désormais une transaction.
- **Historique** `GET /admin/moderation/:type/:id` : décisions successives, motif et auteur.
- **Droit** `moderation.manage` (rôles `admin` et `moderator`), nouvel onglet « Modération » et compteur « à modérer » sur le tableau de bord.
- **Côté fournisseur** : le profil fournisseur affiche le statut de modération de l'organisation et le motif d'un éventuel rejet.
- Textes en 9 langues. Tests : `tests/functional/admin_moderation.spec.ts`, `tests/functional/supplier_profile.spec.ts`, `tests/inertia/admin_moderation.spec.ts`.
