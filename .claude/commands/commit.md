Génère un message de commit pour les changements actuellement staged.

Règles :
- Format : Conventional Commits (feat:, fix:, refactor:, chore:, test:, docs:, perf:, style:, ci:).
- En anglais.
- Présent impératif : "add X" pas "added X".
- Une ligne de titre (max 72 chars) + corps optionnel si changements complexes.
- Si plusieurs changements distincts → suggérer de splitter en plusieurs commits.

Étapes :
1. Lance `git diff --staged` pour voir les changements.
2. Identifie le type principal du commit.
3. Formule le titre.
4. Si nécessaire, ajoute un corps qui explique le pourquoi (pas le quoi).
5. Affiche le message final dans un bloc code, prêt à coller.

Ne lance PAS `git commit` toi-même. Affiche juste le message.
