# Admin de démo sans organisation (2026-11-03)

`DevUserSeeder` garantit maintenant que `admin@promotionnal-sourcing.test` est **uniquement** admin plateforme : à chaque seed, ses rattachements à des organisations (fournisseur ou agence) et son organisation courante sont supprimés, y compris sur une base locale déjà peuplée. Aucune route ni permission ne change. Test : `tests/functional/admin_platform_role.spec.ts`.
