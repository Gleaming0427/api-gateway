---
name: spec-driven-dev
description: Use when starting a new feature, planning implementation, or when the user asks to "write a spec", "draft", "plan", or describes a non-trivial change before coding. Activate before any feature implementation that touches more than 1-2 files.
---

# Spec-Driven Development

Avant toute feature non-triviale (>1 fichier, >50 lignes, ou logique nouvelle), produire une spec courte et la faire valider avant de coder.

## Format de spec

Sauvegarder dans `docs/specs/[nom-feature].md`.

## [Titre de la feature]

### Contexte
[1-2 phrases : pourquoi cette feature existe]

### Objectif
[1 phrase mesurable : ce que l'utilisateur peut faire à la fin. Pour une API : "l'endpoint répond en <100ms P99 et retourne 429 si le rate limit est dépassé"]

### Critères d'acceptation
- [ ] [Comportement précis 1]
- [ ] [Comportement précis 2]
- [ ] [Comportement précis 3]

### Cas limites
- [Edge case 1 et comportement attendu]
- [Edge case 2 et comportement attendu]

### Architecture
- **Fichiers à créer :** [src/core/, src/adapters/, src/functions/, src/stacks/]
- **Fichiers à modifier :** [liste]
- **Endpoint API Gateway :** [méthode, path, authorizer]
- **Schéma DynamoDB :** [table, clé de partition, clé de tri, GSI]
- **Secrets / IAM :** [si applicable]

### Hors scope
- [Ce qui ne sera PAS fait dans cette itération]

### Plan d'implémentation
1. [Étape testable — commencer par core/ si nouvelle logique]
2. [Étape testable — puis adapters/ si nouveau besoin AWS]
3. [Étape testable — enfin stacks/ et functions/]

## Règles

- Une spec doit tenir sur **1 page** (pas un roman).
- Critères d'acceptation = phrases au présent, vérifiables, idéalement avec une métrique.
- "Hors scope" est obligatoire (évite le scope creep).
- Plan en étapes **testables individuellement**.
- Sécurité et perf mentionnées si pertinentes pour la feature.
- Pour les endpoints : spécifier le code de succès, les codes d'erreur possibles, et le format de réponse.

## Workflow

1. Écrire la spec selon le format.
2. Sauvegarder dans `docs/specs/`.
3. Présenter à l'utilisateur pour validation.
4. **Ne pas coder** avant validation explicite.
5. Une fois validée, suivre le plan étape par étape.
6. Si la réalité diverge de la spec, mettre à jour la spec avant de coder le delta.

## Things to Avoid

- Pas de spec vague type "améliorer la perf".
- Pas de plan en une seule étape monolithique.
- Pas de critères flous ("doit être rapide" → préciser P99 < Xms).
- Pas de spec rédigée après le code (perd tout l'intérêt).
- Pas de spec sans endpoint/méthode/status codes pour les features API.
