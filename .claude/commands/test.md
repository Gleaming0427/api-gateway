Génère les tests pour : $ARGUMENTS

Si aucun argument fourni, demande quel fichier tester.

Règles :
- Utilise Vitest (selon CLAUDE.md).
- Tests à côté du fichier : `foo.ts` → `foo.test.ts`.
- Format AAA (Arrange, Act, Assert).
- Teste les comportements, pas l'implémentation.
- Couvre : happy path, edge cases (null, empty, expired, throttled), error cases (DynamoDB error, invalid JWT, malformed input).
- Pas de mocks excessifs : préférer le code réel quand c'est rapide. Mocker uniquement les adapters AWS.
- Core : tests purs sans aucun mock.
- Lambda handlers : mocker les adapters, tester le flux entrée → core → sortie.
- Une assertion par test idéalement.

Étapes :
1. Lis le fichier cible.
2. Identifie les fonctions/handlers à tester.
3. Liste les cas à couvrir (en commentaire au début du fichier de test).
4. Implémente les tests.
5. Lance `npx vitest run -t "[fichier]"` pour vérifier qu'ils passent.
6. Si tests échouent → corrige et relance.
