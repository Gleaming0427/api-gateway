---
name: commit-conventions
description: Use when generating commit messages, drafting MR descriptions, or organizing changes into commits. Activate when user says "commit", "génère un message de commit", "prépare la MR", or when changes are ready to be committed.
---

# Commit Conventions

Tous les commits suivent **Conventional Commits**, en anglais, présent impératif.

## Format

```
<type>(<scope>): <subject>
<body optionnel>
<footer optionnel>
```

- **Subject line** ≤ 72 caractères, présent impératif (`add`, pas `added`).
- **Pas de point** à la fin du subject.
- **Body** uniquement si le pourquoi n'est pas évident depuis le subject.
- **Footer** pour breaking changes ou refs d'issues.

### Types autorisés

| Type | Usage |
|------|-------|
| `feat` | Nouvelle fonctionnalité |
| `fix` | Correction de bug |
| `refactor` | Refactor sans changement fonctionnel |
| `perf` | Optimisation perf |
| `style` | Formatage uniquement (pas de logique) |
| `test` | Ajout/modif de tests |
| `docs` | Documentation |
| `chore` | Deps, config, build, outillage |
| `ci` | Modifs pipeline CI/CD |

### Scope (optionnel)

Module ou domaine concerné, en kebab-case minuscule :

```
feat(rate-limiter): add sliding window algorithm
fix(auth): handle JWKS fetch timeout
refactor(core): extract token validation to pure function
perf(dynamo): batch read API keys in authorizer
chore(deps): bump sst from 3.x to 3.y
docs(stacks): document ApiStack resources
```

### Règles supplémentaires

- Un commit = un changement cohérent. Si plusieurs choses indépendantes → splitter.
- Refactor + feature dans le même commit = à splitter.
- Si breaking change : `feat!:` ou `fix!:` + footer `BREAKING CHANGE: ...`.
- Pas de `WIP`, `fix typo`, `update` comme messages finaux.
- Pas de messages vides type `chore: misc updates`.

### Workflow

1. Lire `git diff --staged` pour comprendre les changements.
2. Identifier le type principal.
3. Identifier le scope si pertinent (core, auth, rate-limiter, dynamo, stacks, etc.).
4. Formuler le subject (verbe + objet, concis).
5. Si changements complexes : ajouter un body qui explique le pourquoi, pas le quoi.
6. Présenter le message dans un bloc code, prêt à copier.

### Exemples valides

```
feat(rate-limiter): add token bucket implementation in DynamoDB
fix(auth): handle expired JWT gracefully with 401
refactor(core): extract validation schemas to shared module
perf(gateway): cache JWKS fetch across Lambda invocations
chore(deps): bump @aws-sdk/client-dynamodb from 3.500 to 3.600
docs(readme): add multi-region architecture diagram
ci(gitlab): add sst diff step to MR pipeline
```

### Things to Avoid

Pas de "added X", "fixed Y" (passé) → présent impératif.
Pas de subject > 72 chars.
Pas de "minor changes", "various fixes", "update stuff".
Pas de mélange de types dans un seul commit.
Pas de body qui paraphrase le subject.
Pas de commit auto-généré non revu (toujours valider le contenu staged avant).
