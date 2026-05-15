# API Gateway HA pour SaaS B2B — Product Roadmap v2

## Product Vision

**L'alternative open source à Zuplo, self-hostée dans VOTRE compte AWS.**

Un SaaS B2B qui expose une API à ses clients n'a que des mauvaises options : Zuplo est proprio et tourne chez Cloudflare, Kong/Tyk sont des usines à gaz, et AWS API Gateway ne sait pas faire de rate limiting per-API-key sans se battre. Résultat : les équipes passent 3-6 mois à construire une surcouche maison.

Ce projet donne la seule chose qui n'existe pas en 2026 : **un API Gateway serverless multi-région, open source (MIT), qui tourne dans votre propre compte AWS.** Clone, configure, déploie en 1h.

Le package npm (`@julienchapron/api-gateway-core`) est le **moteur**. Le template (`api-gateway-ha-template`) est le **produit**. Le conseil est le **business**.

---

## Analyse concurrentielle — La vérité du marché en 2026

### Zuplo est le concurrent direct. Il faut le dire.

Zuplo fait presque tout ce que cette roadmap décrit :
- Serverless edge (300+ datacenters Cloudflare), GitOps, programmable en TypeScript
- Rate limiting, JWT/OAuth, validation, portail développeur, monétisation Stripe
- **Free tier : 100K req/mois, RPS illimité** — ça couvre la fourchette haute de notre ICP
- Builder : 25$/mois, Enterprise : à partir de 1K$/mois
- Self-hosted disponible **uniquement en Enterprise**
- MCP Gateway déjà en place pour exposer les APIs aux agents IA

**Notre réponse :** Zuplo est génial jusqu'au jour où t'as besoin de self-hosted (1K$/mois minimum, pas dans ton compte AWS) ou que tu veux auditer le code qui gère tes tokens (proprio = boîte noire). C'est là qu'on entre.

### Le reste du paysage

| Concurrent | Positionnement | Pourquoi on n'est pas eux |
|---|---|---|
| **Kong Konnect** | "The AI Connectivity Company", trillion req/jour | Usine à gaz, pas serverless natif, pas AWS-first |
| **Tyk** | Open source, multi-cloud, developer portal | Lourd, pas pensé pour Lambda + DynamoDB |
| **AWS API Gateway** | Natif AWS, pay-as-you-go | Pas de rate limiting per-API-key natif, multi-région = galère artisanale |
| **Cloudflare API Gateway** | Edge global, rate limiting | Focus sécurité API, pas API management complet |

### Le seul angle qu'ils ne couvrent pas

**Open source + AWS-native + self-hosté dans ton compte.** Personne ne fait ça :
- Zuplo = proprio, Cloudflare
- Kong/Tyk = open source mais lourd, pas serverless
- AWS = natif mais il manque les briques métier (rate limiting per-key)

C'est un petit marché, mais il est réel. La niche qui paie, c'est le SaaS B2B qui :
1. Doit garder ses données dans son propre compte AWS (compliance, sectoriel)
2. Trouve Zuplo trop cher ou trop "boîte noire" (pas d'audit possible du code)
3. Veut du contrôle total et pas de surprise de facturation managée
4. A déjà été brûlé par un managed service qui a changé son pricing

---

## Business Model

### Open Source (Loss Leader — crédibilité)
- `@julienchapron/api-gateway-core` — MIT, npm. Rate limiter, JWT, validation. <50KB, zéro dépendance.
- `api-gateway-ha-template` — MIT, template GitHub. Infra SST complète.
- **Objectif :** étoiles GitHub, téléchargements npm, autorité technique. Pas de revenu direct.

### Consulting & Implementation (Revenue)
- **Audit** : évaluer l'infra API existante, fournir un plan de migration → 1.5K-3K€
- **Implementation** : déployer le template, configurer rate limits/JWT/certificats → 5K-12K€
- **Managed** : maintenance continue, monitoring, réponse aux incidents → 500-1.5K€/mois

### Pourquoi ce modèle est le bon pour ce produit
- Le package npm seul ne se monétise pas — c'est une brique de 1-2 semaines de dev
- Le template est le vrai produit : transformer 3 mois de taf en 1h
- Le conseil est la seule façon de capturer la valeur pour un outil d'infra open source
- La cible (5-50 employés) n'achète pas un SaaS API Gateway à 1K$/mois, mais paie pour de l'implémentation sur mesure

---

## ICP (Ideal Customer Profile)

| Critère | Profil |
|---|---|
| Taille | 5-50 employés |
| Stade | Seed à Series A |
| Stack | AWS-native, ou en cours de migration |
| Trafic API | 1K-100K requêtes/jour, 10-500 clients API |
| Douleur principale | A besoin de rate limiting per-client, de HA multi-région, et ne veut pas sortir de son compte AWS |
| Budget | 5K-12K€ implementation, 500-1.5K€/mois managed |
| Alternatives rejetées | Zuplo (pas self-hosté dans leur AWS), AWS WAF (pas per-key), Kong/Tyk (trop lourd), build in-house (trop long) |

### Signal d'achat fort (les 3 coches)
1. Expose une API REST à des clients externes payants
2. A perdu au moins un deal à cause d'absence de SLA/HA **ou** d'absence de rate limiting per-client
3. Est déjà sur AWS **et** veut y rester (compliance, équipe formée, crédits)

---

## Success Metrics (redimensionnées)

| Métrique | Phase 1 | Phase 2 | Phase 3 |
|---|---|---|---|
| Téléchargements npm / semaine | >50 | >200 | >1 000 |
| GitHub stars | >30 | >100 | >300 |
| Clones du template | >3 | >10 | >30 |
| Leads qualifiés | 0 | 2 | 5 |
| Clients signés | 0 | 1 | 3 |
| Revenu consulting | 0 | >5K€ | >25K€ |

Le marché est plus petit que l'estimation initiale. Les métriques sont recalibrées sur du réaliste.

---

## Phase 0 — Validation Product-Market Fit (semaines 1-2)

### Objectif
Valider que l'ICP existe, qu'il a du budget, et qu'il ressent la douleur Zuplo = pas dans mon AWS. Décider du positionnement exact avant d'écrire du code.

### Actions
- [ ] 5-10 appels avec des CTO/tech leads de SaaS B2B sur AWS
- [ ] Questions clés à poser :
  - "Comment tu gères le rate limiting par client aujourd'hui ?"
  - "T'as regardé Zuplo ? Pourquoi tu l'as pas pris ?"
  - "Multi-région : t'en as besoin maintenant ou c'est dans 6 mois ?"
  - "Tu serais prêt à payer combien pour un truc qui se déploie en 1h dans ton compte ?"
- [ ] Analyse concurrentielle détaillée : Zuplo, Kong, Tyk (features + pricing à jour)
- [ ] Validation du pricing (one-shot vs monthly retainer)

### Livrables
- Profils ICP (3-5 personas)
- Matrice de positionnement : "Zuplo open source dans votre AWS"
- Grille tarifaire (Audit / Implémentation / Managed)
- Premier lead chaud (idéalement une lettre d'intention)

### Critères de succès
- Au moins 3 prospects confirment le pain "Zuplo = pas dans mon compte"
- Au moins 1 prospect prêt à s'engager pour un pilote

---

## Phase 1 — Core Package (semaines 3-5)

### Objectif
Publier `@julienchapron/api-gateway-core` v1.0 sur npm. Rate limiting token bucket, validation JWT RS256, erreurs typées. Zéro dépendance runtime externe, bundle <50 KB gzippé.

### Travail technique
1. **Modèle d'erreur** (`src/core/errors.ts`) — hiérarchie AppError avec code machine + statut HTTP
2. **Rate limiter** (`src/core/rate-limiter.ts`) — token bucket, interface de store pluggable (mémoire, DynamoDB, Redis…)
3. **JWT** (`src/core/jwt.ts`) — RS256, interface JWKS fetcher, validation des claims standards
4. **Validation** (`src/core/validation.ts`) — wrapper Zod avec ValidationError typée

### Exigences package
- Zéro import AWS dans `src/core/` — le core est runtime-agnostique
- 100% test coverage sur `src/core/`
- Bundle <50 KB gzippé
- README avec docs API, installation, exemples
- CI : `npm test` + `npm run build` à chaque push

### Livrables
- `@julienchapron/api-gateway-core` v1.0.0 sur npm
- Badge bundle size dans le README

### Go / No-Go
- Package installable via `npm install`
- Tous les tests passent en CI
- Bundle <50 KB gzippé

---

## Phase 2 — Template & Infrastructure (semaines 6-7)

### Objectif
Publier `api-gateway-ha-template` — le vrai produit. Un template GitHub qu'un CTO clone, configure, et déploie sur son compte AWS en <1h.

C'est **cette phase qui crée la valeur**. Le package npm est le moteur, le template est la voiture.

### Travail technique
1. **Adapter DynamoDB** (`src/adapters/dynamo.ts`) ✅
2. **Adapter JWKS** (`src/adapters/jwks.ts`) ✅
3. **Lambda authorizer** (`src/functions/auth/authorizer.ts`) ✅
4. **Gateway handler** (`src/functions/gateway/proxy.ts`) ✅ — multi-format (V1/V2/Function URL)
5. **Stack SST** (`src/stacks/ApiStack.ts`) ✅ — staging: Function URL, production: API Gateway
6. **Multi-région** (`sst.config.ts`) ✅ — documenté, 2e déploiement manuel
7. **Sécurité** ✅ — `jose` (0 CVE), `fetch({ redirect: "manual" })`, `STAGING_TOKEN`, audit complet
8. **CI/CD** ✅ — `publish.yml` (npm sur tag), `deploy.yml` (workflow_dispatch)

### Exigences template
- ✅ `git clone` + `npm install` + 1 secret = déployable en <5 min (staging)
- ✅ CI/CD : npm publish sur tag `v*`, deploy manuel
- ✅ Documentation : `docs/deployment-guide.md` à jour

### Livrables
- ✅ Template GitHub
- ✅ `docs/deployment-guide.md`
- ✅ Endpoint de démo live : `https://vxowjopv5pfvffqr42gfb6d77u0sbult.lambda-url.eu-west-1.on.aws/`

### Go / No-Go
- ✅ Un utilisateur peut déployer en <5 min en suivant le guide (1 secret, 1 commande)
- ✅ Le proxy retourne 200 (OK), 429 (throttled), 500 (upstream error)
- ⚠️ Multi-région documenté mais nécessite 2e déploiement manuel

---

## Phase 2.5 — AI Gateway (optionnel, à valider en Phase 0)

### Pourquoi c'est nécessaire en 2026
Kong est "The AI Connectivity Company". Zuplo a un MCP Gateway. Sans story AI, le produit est perçu comme un outil 2023. À évaluer pendant les appels de découverte : est-ce que les prospects en ont besoin ?

Si oui, ajouter au scope :
- [ ] **MCP Gateway** — exposer n'importe quelle API comme MCP Server (comme Zuplo)
- [ ] **Token budgeting** — rate limiting sur tokens IA, pas juste sur requêtes HTTP
- [ ] **Semantic caching** — cache de réponses LLM pour réduire les coûts

Si les prospects n'en parlent pas, garder en backlog post-Phase 4.

---

## Phase 3 — Benchmarks & Sales Collateral (semaine 8)

### Objectif
Produire les chiffres et les assets qui ferment des deals face à Zuplo.

### Technique
1. **Benchmark rate limiter** — 100K consume() concurrents, P50/P99 local + DynamoDB
2. **Benchmark JWT** — validation de token mocké, mesure du throughput
3. **End-to-end** — latence mesurée depuis curl en multi-région

### Sales Collateral
- Résultats de benchmark dans le README avec méthodologie
- **"Zuplo vs This"** — tableau comparatif honnête (quand prendre Zuplo, quand prendre ce projet)
- Calculateur de coût AWS : "Ce qu'un SaaS B2B à 50K req/jour paie sur AWS" (<50€/mois)
- One-pager PDF pour prospects
- Vidéo démo : clone → config → deploy → test, en 2 minutes

### Livrables
- `scripts/benchmark.ts` dans le template
- Résultats de benchmark dans le README
- Tableau "Zuplo vs This" dans la doc

---

## Phase 4 — Go-to-Market (semaines 9-12)

### Objectif
2 premiers leads qualifiés, 1 premier client signé.

### Positionnement
**"Zuplo, en open source, dans votre AWS."**

Pas "une alternative à AWS API Gateway" — AWS API Gateway est un outil, pas un concurrent.
Le concurrent c'est Zuplo. Le pitch c'est : Zuplo est excellent, jusqu'au jour où t'as besoin de self-hosted dans ton AWS.

### Actions
- [ ] Landing page
  - Hook : "Zuplo, en open source, dans votre compte AWS"
  - Problème → Solution → Architecture → Benchmarks → "Zuplo vs This" → Pricing → CTA
  - CTA : "Book a 30-min audit call"
- [ ] Content marketing : 3-4 articles de blog
  - "Pourquoi on a open-sourcé un API Gateway multi-région (et pourquoi c'est dans votre AWS)"
  - "Rate limiting per-API-key sur AWS : le guide qui n'existait pas"
  - "Zuplo vs self-hosté AWS : comment choisir en 2026"
  - "On a déployé une API Gateway HA en une heure" (témoignage premier client)
- [ ] Outreach ciblé : 20 CTOs de SaaS B2B identifiés comme étant sur AWS
  - Message personnalisé, pas de template générique
  - Offre d'audit gratuit de leur infra API actuelle
- [ ] Mise à jour du repo avec témoignages et case studies (dès que dispo)

### Livrables
- Landing page en ligne avec "Zuplo vs This"
- 3 articles de blog publiés
- Séquence d'outreach active
- 2 premiers leads qualifiés

### Critères de succès
- Taux de conversion landing page >5%
- Au moins 1 engagement consulting signé

---

## Phase 5 — Scale & Iterate (semaines 13+)

### Objectif
Revenu consulting récurrent, referrals. Le produit évolue selon les demandes réelles des clients.

### Product Road (piloté par les clients)
- [ ] Vérification de signature webhook (demande client fréquente)
- [ ] Dashboard de gestion des clés API
- [ ] Analytics de consommation par client
- [ ] Tiers de rate limit customs par customer (v1.1)
- [ ] MCP Gateway (si pas fait en Phase 2.5, quand c'est demandé)
- [ ] Support GraphQL (si les clients en ont besoin)

### Business Road
- [ ] Playbook de delivery consulting (process, templates, checklists)
- [ ] Case studies des 3 premiers clients
- [ ] Programme de referral
- [ ] Talks dans meetups AWS / Serverless
- [ ] Potentiel : SaaS managé (version hébergée, abonnement mensuel)
  - Seulement si le revenu consulting est stable ET que les clients le demandent
  - Nécessite infra séparée, équipe support, on-call

---

## Summary Timeline

| Phase | Timeline | Livrable clé | Revenu |
|---|---|---|---|
| 0. PMF Validation | S1-S2 | ICP, pricing, positionnement vs Zuplo | 0 |
| 1. Core Package | S3-S5 | `@julienchapron/api-gateway-core` v1.0 sur npm | 0 |
| 2. Template | S6-S7 | `api-gateway-ha-template` sur GitHub | 0 |
| 2.5. AI Gateway | *optionnel* | MCP Gateway + token budgeting | 0 |
| 3. Benchmarks | S8 | Tableau "Zuplo vs This", cost calculator | 0 |
| 4. Go-to-Market | S9-S12 | Landing page, outreach, premier client | >5K€ |
| 5. Scale | S13+ | Consulting récurrent, itération produit | >25K€ |

---

## Dependency Order

```
Phase 0 (PMF) — OBLIGATOIRE : valide que "Zuplo pas dans mon AWS" est un vrai pain
    ↓
Phase 1 → Phase 2 → Phase 3 (séquentiel : package → template → benchmarks)
    ↓
Phase 4 (GTM) peut chevaucher Phase 3
    ↓
Phase 5 (Scale) — continu, jamais vraiment "fini"
```

Si les critères de Go/No-Go d'une phase ne sont pas atteints, ne pas passer à la suivante.

---

## Questions ouvertes à trancher en Phase 0

1. **Le pain "Zuplo pas dans mon AWS" est-il réel ?** Si les prospects répondent "je m'en fous, Zuplo gratos c'est parfait", il faut pivoter. La Phase 0 répond à ça.

2. **AI Gateway maintenant ou plus tard ?** Si les prospects parlent de MCP/LLM/agents pendant les appels, c'est Phase 2.5 obligatoire. Sinon, backlog.

3. **Pricing implementation : 5K ou 12K ?** À calibrer selon la disposition à payer réelle des prospects, pas selon nos hypothèses.

4. **Est-ce que le template doit supporter autre chose qu'AWS ?** Cloudflare Workers ? Vercel Edge ? À trancher selon les appels de découverte.
