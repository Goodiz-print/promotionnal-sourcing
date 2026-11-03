# Correctif : classement des fournisseurs consultés (« Ce que cherchent les clients »)

> Date : 2026-11-03

Correctif de l'écran `GET /admin/demand` (#173).

- **Problème** : les consultations de fiches fournisseur enregistrent l'id de la fiche (`suppliers.id`) dans `activity_events.target_id`, mais le classement des fournisseurs les rapprochait de `organizations.id`. Les noms affichés étaient ceux d'autres organisations, ou absents.
- **Correction** : le nom vient de `supplier_translations` (langue de l'écran, repli `fr`, puis `#<id>`), comme pour les produits. Le test utilise désormais une vraie fiche fournisseur du jeu de données.
