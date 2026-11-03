# Menu latéral réduit : le contenu reprend la place (2026-11-03)

`useSidebarCollapsed` ne lit plus le choix mémorisé pendant le `setup` mais à `onMounted`. Le SSR rend toujours le menu déplié ; lire la valeur plus tôt faisait diverger l'hydratation, et Vue ne corrige pas les classes d'un DOM hydraté : la grille du layout gardait la largeur dépliée (264 px) alors que le menu était réduit (72 px), laissant un vide. Aucune route ni permission ne change.
