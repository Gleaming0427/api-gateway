Fais un audit perf de : $ARGUMENTS

Si aucun argument, demande la cible (route API, handler Lambda, query DynamoDB).

Cherche :
- **Lambda** : cold starts (taille du bundle, imports lourds), mémoire sous-dimensionnée, timeout proche du P99, initialisation hors handler.
- **DynamoDB** : hot partitions (mauvaise clé de partition), queries sans index (scan), absence de pagination, batch operations manquants, N+1 reads.
- **API Gateway** : payload trop large (>1MB), pas de compression, pas de caching pour les réponses stables, timeout API Gateway vs Lambda désaligné.
- **JWT** : pas de cache de clé JWKS, validation synchrone sur chaque requête.
- **Rate Limiter** : token bucket en DynamoDB sans Optimistic Locking, latence du write DB bloquant la requête.
- **Multi-région** : Route 53 latency routing non testé, DynamoDB Global Table convergence lente.

Format :
- Liste les problèmes par impact (high / medium / low).
- Pour chaque problème : ligne concernée + fix proposé en 1-2 lignes.
- Termine par les 3 actions prioritaires qui auront le plus d'impact sur la latence P99.

Objectif absolu : P99 < 100ms end-to-end.
