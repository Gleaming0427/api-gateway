Refactor : $ARGUMENTS

Si argument est un chemin, refactor ce fichier. Sinon demande la cible.

Règles :
- Préserve le comportement (les tests doivent toujours passer).
- Améliore : lisibilité, naming, séparation core/adapters, gestion d'erreurs.
- Pas de changement fonctionnel sans le signaler.
- Suis les conventions du projet (CLAUDE.md + skills).
- Modifie le minimum nécessaire pour le gain visé.

Étapes :
1. Lis le fichier cible.
2. Identifie 3-5 améliorations prioritaires.
3. Présente-les en bullets, demande validation.
4. Une fois validé, applique les refactors un par un.
5. Lance les tests existants après chaque refactor.
6. Si tests échouent → revert et explique pourquoi.

Termine par un récap : ce qui a changé, pourquoi, impact.
