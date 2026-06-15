---
name: aws-deploy
description: Use when working on AWS infrastructure, SST configuration, deployment, IAM roles, secrets management (SSM/Secrets Manager), Lambda functions, API Gateway, DynamoDB, Route 53, or anything in src/stacks/. Activate for tasks involving sst.config.ts, SST Ion, deploy commands, AWS regions, multi-region architecture, or cloud architecture decisions.
---

# AWS Deployment — API Gateway Multi-Région

## Architecture

```
Route 53 (latency-based routing)
├── eu-west-1 (Ireland) — primaire
│   ├── API Gateway REST API (edge-optimized)
│   ├── Lambda (ARM/Graviton, 512 MB) handlers + authorizer
│   └── DynamoDB Global Table v2
└── us-east-1 (N. Virginia) — secondaire
    ├── API Gateway REST API (edge-optimized)
    ├── Lambda (ARM/Graviton, 512 MB) handlers + authorizer
    └── DynamoDB Global Table v2 (répliquée automatiquement)
```

## Stack technique

- **Compute**: Lambda@ARM (Graviton) → TypeScript handlers, esbuild bundled
- **API**: API Gateway REST (pas HTTP — besoin du cache d'authorizer REST)
- **Storage**: DynamoDB Global Tables v2 avec on-demand capacity
- **DNS**: Route 53 avec latency-based routing entre les 2 régions
- **TLS**: ACM certificat par région (API Gateway régional)
- **Secrets**: AWS Secrets Manager via `sst.Secret`
- **Monitoring**: CloudWatch metrics + alarms (P99, 5xx, throttle, IteratorAge)

## SST Conventions

- Infrastructure dans `src/stacks/`, en TypeScript.
- SST Ion mode — `sst.Resource` pour les bindings typés.
- Un stack principal `ApiStack.ts` déployé identiquement dans les 2 régions.
- Variables sensibles via `sst.Secret`, jamais en clair.
- Stages : `dev` (perso) et `production` (multi-région live).
- `sst.config.ts` définit les régions et le stage mapping.

## IAM

- Principe du moindre privilège systématiquement.
- Pas de `*` dans les Actions ou Resources sauf justification documentée.
- Rôle IAM par fonction :
  - Lambda handlers → lecture/écriture DynamoDB (table spécifique)
  - Lambda authorizer → lecture Secrets Manager (clé JWT)
  - Rate limiter → lecture/écriture DynamoDB (table spécifique)
- CI : IAM user dédié avec permissions limitées au déploiement SST (pas d'admin).

## Secrets

- Jamais dans le repo. `.gitignore` doit contenir `.env*`, `.sst/`, `cdk.out/`.
- En dev local : `.env.local`.
- En prod : AWS Secrets Manager via `sst.Secret`.
- Secrets requis : JWKS URL, signing key ID, API keys (rate limiter bypass list).
- Rotation via `sst secret set <name> <value> --stage production`.

## Monitoring & Alerting

- CloudWatch Logs pour les Lambdas (rétention 7 jours dev, 30 jours prod).
- CloudWatch Metrics :
  - `Latency` P99 < 100ms
  - `5XXError` < 0.01%
  - `Throttle` < 0.1%
  - `Count` (débit)
- Alarms :
  - P99 > 150ms pendant 5 min → alerte
  - 5xx > 1% pendant 1 min → critique
  - Throttle rate > 5% → alerte
- Dashboard CloudWatch avec widgets par région.

## Multi-Région Spécificités

- Chaque région est indépendante. Pas de failover inter-région automatique dans la logique métier.
- Route 53 fait le routage initial. Le client reste dans la même région pour toute la session.
- DynamoDB Global Tables : conflits résolus last-writer-wins. Adapté pour le rate limiting (pas critique si un compteur est légèrement désynchronisé).
- Déploiement séquentiel : d'abord eu-west-1, valider, puis us-east-1. Jamais les deux en parallèle.

## Security Headers (API Gateway)

Configurer via API Gateway response mapping :
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Cache-Control: no-store` pour les réponses authentifiées

## Deploy Workflow

1. Local : `npx sst dev` pour tester en mode live Lambda contre AWS.
2. MR ouverte : CI lance `npx sst diff --stage staging` pour voir les changements d'infra.
3. Merge sur `main` : CI lance `npx sst deploy --stage production` (eu-west-1 d'abord, us-east-1 ensuite).
4. Si je dis "déploie", **toujours demander confirmation explicite** avant d'exécuter — les ressources AWS et le DNS sont irréversibles.

## Things to Avoid

- Pas de modifs de `sst.config.ts` sans en parler avant.
- Pas de credentials AWS hardcodés (utiliser AWS profile ou SSO local).
- Pas de Lambda avec timeout > 30s (revoir l'archi si besoin).
- Pas de table DynamoDB sans on-demand ou auto-scaling configuré.
- Pas de code spécifique à une région dans `core/`. Les conditionnels région sont dans `stacks/`.
- Pas de déploiement unique couvrant deux régions sans déploiement parallèle explicite.
