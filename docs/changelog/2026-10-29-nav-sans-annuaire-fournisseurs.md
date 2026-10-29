# Navigation : retrait de l'entrée « Fournisseurs »

> Date : 2026-10-29

`NavigationService` n'ajoute plus l'entrée `suppliers` (`suppliers.index`) au menu latéral,
ni pour les visiteurs ni pour les membres connectés : l'annuaire des fournisseurs est pour
le moment réservé aux admins, et le fournisseur sert surtout de filtre dans la recherche produits.

Les routes `suppliers.index` et `suppliers.show` ne changent pas (la fiche produit renvoie
toujours vers la fiche fournisseur). Tests de navigation (unitaire et fonctionnel) mis à jour.
