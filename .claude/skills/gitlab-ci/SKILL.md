---
name: gitlab-ci
description: Use when working on GitLab CI/CD, .gitlab-ci.yml, merge request templates, commit conventions, GitLab variables, or deployment pipelines. Activate for tasks involving CI configuration, pipeline debugging, or GitLab-specific Git workflow.
---

# GitLab CI/CD & Workflow

## Pipeline Structure (.gitlab-ci.yml)

Stages : `lint` → `test` → `build` → `deploy-staging` → `deploy-production`.

- **lint** : `npx eslint . && npx tsc --noEmit`
- **test** : `npx vitest run`
- **build** : `npx sst build --stage production` (vérifie que l'infra compile)
- **deploy-staging** : `npx sst deploy --stage staging` — région unique eu-west-1
- **deploy-production** : 
  - `npx sst deploy --stage production --region eu-west-1`
  - `npx sst deploy --stage production --region us-east-1`
  - Uniquement sur `main`, uniquement manuel (quand?)  

## Variables CI

Définir dans GitLab Settings → CI/CD → Variables (masquées et protégées) :
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_DEFAULT_REGION` (optionnel)

Objectif cible : passer à OIDC GitLab → AWS pour éviter les credentials longue durée.

## Merge Requests

- MR (Merge Request) avec description + checklist (tests, types, lint, SST diff).
- Une feature = une branche.
- Pas de commit direct sur `main`.
- Squash and merge par défaut.
- Reviewer assigné si projet collaboratif.

## Commit Conventions

Conventional commits :
- `feat:` nouvelle fonctionnalité (ex: `feat(rate-limiter): add sliding window algorithm`)
- `fix:` correction de bug
- `refactor:` refactor sans changement fonctionnel
- `chore:` tâches diverses (deps, config)
- `test:` ajout/modif de tests
- `docs:` documentation
- `perf:` optimisation (ex: `perf(auth): cache JWKS key in memory`)
- `style:` formatage uniquement
- `ci:` modifs pipeline

Messages au présent impératif : `feat: add rate limiter` (pas `added`).

## Things to Avoid

- Pas de credentials en clair dans `.gitlab-ci.yml`.
- Pas de jobs sans `needs:` explicites (sinon stages sérialisés inutilement).
- Pas de cache pnpm absent (toujours cacher `~/.pnpm-store` ou `node_modules`).
- Pas de deploy sur push direct si pas sur `main`.
- Pas de déploiement multi-région sans vérifier le premier déploiement d'abord.
