# Sections d'administration dans le menu latéral (2026-11-03)

Dans le back-office (pages `admin/*`), le menu latéral affiche les sections d'administration (tableau de bord, organisations, utilisateurs, catégories, attributs, modération, agences, demande clients, journal d'audit), filtrées par droit du rôle plateforme, avec une icône chacune. La barre d'onglets en tête des pages admin est supprimée, ce qui libère de la place. Les sections viennent toujours de `useAdminTabs` ; aucune route ni permission ne change (le serveur re-vérifie chaque droit).
