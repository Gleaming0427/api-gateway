Crée une spec détaillée pour la feature suivante : $ARGUMENTS

Si aucun argument, demande la feature.

Format de spec à produire :

# [Titre de la feature]

## Contexte
[Pourquoi cette feature, quel problème elle résout]

## Objectifs
- [Objectif mesurable 1]
- [Objectif mesurable 2]

## User Stories
- En tant que [rôle], je veux [action] pour [bénéfice]

## Critères d'acceptation
- [ ] [Comportement précis 1]
- [ ] [Comportement précis 2]

## Cas limites à gérer
- [Edge case 1]
- [Edge case 2]

## Architecture proposée
- Fichiers à créer/modifier (dans `src/core/`, `src/adapters/`, `src/functions/`, `src/stacks/`)
- Stack SST impactée
- Table DynamoDB (clé de partition, clé de tri, GSI si applicable)
- Route API Gateway (path, méthode, authorizer)
- Secrets / IAM nécessaires

## Stack utilisée
[Liste des patterns/libs selon CLAUDE.md et skills]

## Hors scope
[Ce qui ne sera PAS fait dans cette feature]

## Plan d'implémentation
1. [Étape 1 — commencer par core/ si nouvelle logique métier]
2. [Étape 2]
3. [Étape 3]

---

Sauvegarde la spec dans `docs/specs/[nom-feature].md`.
Ne code RIEN. Demande validation avant d'implémenter.
