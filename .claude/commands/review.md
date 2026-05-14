Fais une review complète des changements en cours (staged et unstaged).

Pour chaque fichier modifié :
1. Lis le diff avec `git diff` et `git diff --staged`.
2. Identifie les problèmes potentiels :
   - Bugs ou edge cases non gérés
   - Violations des conventions du projet (voir CLAUDE.md et skills)
   - Code smell : duplications, fonctions trop longues, naming peu clair
   - Sécurité : inputs non validés, secrets en dur, IAM over-privilege, JWT bypass possible
   - Performance : DynamoDB N+1, absence de cache, cold start aggravé, scan au lieu de query
   - Architecture : logique métier dans un adapter, import AWS SDK dans core/
   - Rate limiting : race condition, pas de Retry-After header

Format de sortie :
- Liste les problèmes par fichier, par ordre de gravité.
- Ignore les détails de style mineurs (Prettier s'en charge).
- Si tout est bon, dis-le clairement.
- Termine par un verdict : "Prêt à commit" ou "Corrections nécessaires".

Ne corrige rien automatiquement, juste signale.
