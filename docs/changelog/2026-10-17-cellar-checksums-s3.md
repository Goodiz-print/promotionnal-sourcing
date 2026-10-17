# Client S3 Cellar : checksums `WHEN_REQUIRED`

> Date : 2026-10-17

Le `S3Client` de `CellarStorageDriver` passe `requestChecksumCalculation` et `responseChecksumValidation` à `WHEN_REQUIRED`. Depuis le SDK AWS v3.729, les checksums sont calculés par défaut et Cellar (Clever Cloud) peut les rejeter ; on ne les active plus que lorsque l'opération l'exige. Aucun changement de comportement côté application.
