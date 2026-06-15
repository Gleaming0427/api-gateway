Nettoie le code dans le scope : $ARGUMENTS

Si aucun argument, fait sur tout le projet.

Cherche et propose de retirer :
- `console.log`, `console.debug` oubliés.
- Imports non utilisés.
- Variables et fonctions déclarées mais jamais utilisées.
- Code commenté laissé en place.
- TODOs anciens (proposer de les fixer ou de les retirer).
- Dépendances dans `package.json` qui ne sont jamais importées.
- Fonctions `core/` exportées mais jamais appelées.
- Handlers Lambda morts (non référencés dans une stack SST).

Étapes :
1. Identifie tout ce qui peut être nettoyé.
2. Liste par catégorie avec le chemin de fichier.
3. Demande validation avant d'appliquer.
4. Une fois validé, applique en une fois.
5. Lance `npx tsc --noEmit && npx eslint .` pour confirmer que rien n'est cassé.

Ne touche pas au code défensif légitime (try/catch, validations, IAM safeguards).
