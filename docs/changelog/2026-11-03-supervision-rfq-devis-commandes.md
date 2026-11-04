# Supervision des demandes de devis, devis et commandes (2026-11-03)

Issue #166 (epic #157). Le back-office affiche trois nouvelles sections, visibles par les rôles `admin`, `support` et `analyst` (droit `trade.view`) : **Demandes de devis**, **Devis**, **Commandes**.

- **Routes** : `admin.rfqs.index|show`, `admin.quotes.index|show`, `admin.orders.index|show` (lecture) ; `admin.rfqs.close|expire|remind` (POST, droit `trade.manage`, admin seul).
- **Filtres** : statut, acheteur, fournisseur, période de création ; sur les demandes, repérage `overdue` (échéance passée non basculée) et `no_response` (publiée depuis 3 jours sans devis).
- **Interventions** : clôturer, faire expirer (les devis ouverts expirent avec la demande), relancer les fournisseurs silencieux (une relance par destinataire). Chacune est tracée dans le journal d'audit (`rfq.closed`, `rfq.expired`, `rfq.reminded`).
- **Droits** : nouveaux `trade.view` (admin, support, analyst) et `trade.manage` (admin).
- **Technique** : `RfqService#expire` et `#markReminded` acceptent une transaction optionnelle.
