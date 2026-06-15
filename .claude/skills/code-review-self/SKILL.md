---
name: code-review-self
description: Use after generating or modifying code, before considering a task done. Provides a systematic checklist for self-review of generated code. Activate when user says "review your changes", "vérifie ton code", or before any final delivery.
---

# Self Code Review Checklist

Avant de présenter une modification comme finale, passer en revue cette checklist. Reporter explicitement chaque point validé ou problématique.

## 1. Correctness

- [ ] Le code répond aux critères d'acceptation de la spec / demande.
- [ ] Edge cases gérés : null/undefined, tableaux vides, valeurs limites, token expiré, rate limit atteint.
- [ ] Erreurs gérées : try/catch sur les opérations qui peuvent échouer (DynamoDB, appel externe).
- [ ] Pas de logique morte ou de chemins de code inatteignables.
- [ ] Rate limiter : pas de race condition, token bucket atomique.

## 2. Conventions du projet

- [ ] Respect du `CLAUDE.md` et des skills actifs.
- [ ] Style cohérent avec les fichiers voisins.
- [ ] Logique métier dans `core/`, adapters AWS dans `adapters/`.
- [ ] Ressources via `sst.Resource`, pas de noms en dur.
- [ ] Erreurs qui étendent `AppError` avec `code` machine.
- [ ] Nommage cohérent avec le reste du projet.

## 3. TypeScript

- [ ] Aucun `any` introduit.
- [ ] Types explicites sur les fonctions exportées.
- [ ] Pas de `@ts-ignore` ou `@ts-expect-error` sans justification.
- [ ] `npx tsc --noEmit` passe.

## 4. Sécurité

- [ ] Inputs externes validés (Zod ou équivalent).
- [ ] Pas de secrets en dur (utiliser `sst.Secret`).
- [ ] Pas de concaténation d'input utilisateur dans des requêtes DynamoDB (injection NoSQL).
- [ ] JWT : validation complète (signature, expiration, issuer, audience).
- [ ] IAM : privilège minimal, pas de wildcard.
- [ ] Rate limiting appliqué avant toute logique métier.

## 5. Performance

- [ ] Pas de DynamoDB Scan (utiliser Query avec GSI si nécessaire).
- [ ] Pas de reads DynamoDB en boucle sans batch.
- [ ] JWKS cache en mémoire avec TTL (ne pas fetch à chaque requête).
- [ ] Lambda handler : initialisation hors handler (clients SDK, config).
- [ ] Pas d'opération synchrone cross-région.

## 6. Tests

- [ ] Tests existants passent (`npx vitest run`).
- [ ] Nouveau comportement non-trivial → au moins 1 test ajouté.
- [ ] Tests core/ sans aucun mock AWS.
- [ ] Tests vérifient le comportement, pas l'implémentation.

## 7. Propreté

- [ ] Pas de `console.log` oubliés.
- [ ] Pas de code commenté laissé en place.
- [ ] Pas de TODO sans contexte.
- [ ] Pas de dépendance ajoutée sans justification.

## 8. Infra (si stacks SST touchées)

- [ ] IAM : privilège minimal vérifié.
- [ ] DynamoDB : clé de partition + clé de tri adaptées à l'accès pattern.
- [ ] Lambda : mémoire, timeout, architecture (ARM) configurés.
- [ ] API Gateway : authorizer référencé, cache configuré.
- [ ] Secrets : pas exposés dans les outputs de stack.

## Output attendu

À la fin, produire un récap court :✅ Self-review complèteValidés : [N/8 catégories]
Points d'attention :

[Catégorie] : [Détail]
Verdict : [Prêt / À corriger]

Si verdict "À corriger", **ne pas livrer** comme final. Itérer jusqu'à validation.
