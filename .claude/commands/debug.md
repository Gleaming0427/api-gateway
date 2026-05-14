Debug le problème suivant : $ARGUMENTS

Si aucun argument, demande la description du problème.

Étapes :
1. Demande des précisions si la description est trop vague (message d'erreur exact, contexte, région, stage, ce qui est attendu vs observé).
2. Forme une hypothèse sur la cause probable. Pour un projet API Gateway, considère :
   - Validation JWT (claims, expiration, algorithme de signature)
   - Permissions IAM (Lambda → DynamoDB, Secrets Manager)
   - Schéma DynamoDB (clé de partition, GSI, hot partition)
   - Rate limiter (race condition token bucket, état partagé multi-région)
   - Cold start Lambda (latence P99 dégradée)
   - Bindings SST (ressource non résolue, mismatch entre régions)
3. Liste les fichiers/zones à investiguer en priorité.
4. Lis-les méthodiquement.
5. Propose des changements ciblés ou des points à vérifier (CloudWatch logs, X-Ray traces).
6. Si la cause est claire : propose le fix avec explication.
7. Si pas certain : propose plusieurs hypothèses ordonnées par probabilité.

Ne refactor pas du code non lié au bug.
N'ajoute pas de console.log (sauf si explicitement demandé pour debug ponctuel).
