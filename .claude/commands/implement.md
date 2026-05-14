Implémente la spec : $ARGUMENTS

Si argument est un chemin de fichier, lis-le. Sinon demande quelle spec.

Étapes :
1. Lis la spec en entier.
2. Liste l'ordre d'implémentation des étapes (du plan).
3. Pour chaque étape :
   - Annonce ce que tu vas faire.
   - Implémente.
   - Vérifie (typecheck, lint, tests si applicable).
4. À la fin : récap des fichiers modifiés/créés en bullets.
5. Lance `npx tsc --noEmit && npx eslint .`.
6. Si tests existent : lance `npx vitest run`.
7. Si quelque chose échoue, corrige et relance.

Suis strictement les conventions du projet (CLAUDE.md + skills). En particulier :
- Logique métier dans `core/`, pas dans les handlers.
- Pas d'import AWS SDK dans `core/`.
- Ressources AWS via `sst.Resource`, jamais en dur.
- Erreurs via `AppError` avec code machine.
Ne dévie pas de la spec sans demander.
