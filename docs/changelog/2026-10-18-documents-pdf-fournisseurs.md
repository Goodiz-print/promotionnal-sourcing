# Documents PDF des fournisseurs : compression Ghostscript et stockage (#60)

Date : 2026-10-18

- **Compression** : `PdfService` (Ghostscript, profil `/ebook`) avec repli sans crash si `gs` manque ou n'allège pas le fichier.
- **Tables** : `organization_documents` (catalogue, certificat, autre) et `product_documents` (fiche technique), avec migrations et `down()`.
- **Stockage** : via `StorageService` (Cellar), avec retrait transactionnel et purge différée. Les deux tables sont ajoutées à `STORAGE_REFERENCES`.
- **Tests** : 5 unitaires (`PdfService`), 5 fonctionnels (`DocumentService`).
- **Non couvert** : interfaces (profil, annuaire public, formulaire produit) et routes HTTP.
