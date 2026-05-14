# Phase 1 — Core Package : Détail technique

## Objectif

Publier `@julienchapron/api-gateway-core` v1.0.0 sur npm. Quatre modules purs, zéro dépendance AWS, un seul contrat : les interfaces de port.

## Architecture des 4 modules

```
src/core/
├── errors.ts          # AppError + 4 sous-classes
├── rate-limiter.ts    # Token bucket, interface RateLimiterStore
├── jwt.ts             # validateToken(), interface JwksFetcher
├── validation.ts      # validate(), wrapper Zod
└── index.ts           # Surface publique du package
```

Chaque module est indépendant. Le seul couplage autorisé : `rate-limiter.ts`, `jwt.ts`, et `validation.ts` peuvent utiliser les erreurs de `errors.ts`.

---

## 1. `errors.ts` — Modèle d'erreur

### Pourquoi en premier

Tous les autres modules en dépendent. Le modèle d'erreur est le contrat partagé entre le core, les adapters, et les handlers.

### Hiérarchie

```
AppError (abstract)
├── UnauthorizedError  (401)
├── ThrottledError     (429)
├── ValidationError    (400)
└── InternalError      (500)
```

### Interface publique

```ts
abstract class AppError extends Error {
  abstract readonly code: string;       // Machine-readable, ex: "UNAUTHORIZED"
  abstract readonly statusCode: number; // HTTP, ex: 401

  // Format attendu par API Gateway Lambda Proxy
  toLambdaResponse(): {
    statusCode: number;
    headers: { "Content-Type": "application/json" };
    body: string; // JSON.stringify({ error: this.code, message: this.message })
  };
}

class UnauthorizedError extends AppError {
  readonly code = "UNAUTHORIZED";
  readonly statusCode = 401;
  constructor(message = "Missing or invalid token") { super(message); }
}

class ThrottledError extends AppError {
  readonly code = "THROTTLED";
  readonly statusCode = 429;
  readonly retryAfter: number; // secondes avant retry
  constructor(retryAfter: number, message = "Rate limit exceeded") {
    super(message);
    this.retryAfter = retryAfter;
  }
  // Override: ajoute le header Retry-After
  toLambdaResponse(): { ... headers: { "Retry-After": string; ... } }
}

class ValidationError extends AppError {
  readonly code = "VALIDATION_ERROR";
  readonly statusCode = 400;
  readonly details: unknown; // contient les erreurs Zod brutes
  constructor(details: unknown, message = "Request validation failed") { ... }
  // Override: inclut this.details dans le body
}

class InternalError extends AppError {
  readonly code = "INTERNAL_ERROR";
  readonly statusCode = 500;
  constructor(message = "Internal server error") { super(message); }
}
```

### Points d'attention

- `AppError.code` est un contrat public (semver). Chaque code doit être documenté dans le README du package.
- Les sous-classes sont fermées — personne n'hérite de `ThrottledError` pour faire un `CustomThrottledError`.
- `toLambdaResponse()` est une méthode de commodité. Le handler peut aussi choisir de formater lui-même s'il veut un format différent.
- Le message est orienté humain (logs, debug). Le `code` est orienté machine (les clients du SaaS font un switch dessus).

### Tests

| Cas | Assertion |
|---|---|
| Chaque sous-classe | Bon `statusCode`, bon `code` |
| `toLambdaResponse()` de chaque | Body JSON parseable, headers présents |
| `ThrottledError.toLambdaResponse()` | Header `Retry-After` = `retryAfter` |
| `ValidationError.toLambdaResponse()` | Body contient `details` |
| `AppError` ne peut pas être instancié | `new AppError()` throw (abstract) |

---

## 2. `rate-limiter.ts` — Token Bucket

### Algorithme

Token bucket classique :
- Un bucket a une `capacity` (jetons max) et un `refillRate` (jetons ajoutés par seconde).
- `consume(key, tokens)` retire `tokens` jetons.
- Si assez de jetons → `allowed: true`.
- Sinon → `allowed: false`, avec `retryAfter` (secondes avant d'avoir assez de jetons).
- Le refill est calculé au moment du `consume()` : `now - lastRefill` × `refillRate`.

### Interface du port (store)

Le rate limiter ne sait pas où les buckets sont stockés. Il dépend d'une interface :

```ts
interface BucketState {
  tokens: number;        // Jetons restants
  lastRefill: number;    // Timestamp Unix ms du dernier refill
}

interface RateLimiterStore {
  get(key: string): Promise<BucketState | null>;
  set(key: string, state: BucketState): Promise<void>;
}
```

Le store peut être in-memory (tests, bench), DynamoDB (prod), Redis (si le client veut).

### Interface publique du rate limiter

```ts
interface ConsumeResult {
  allowed: boolean;
  remaining: number;   // Jetons restants si allowed
  retryAfter?: number; // Secondes avant retry si denied
}

class RateLimiter {
  constructor(
    store: RateLimiterStore,
    options: { capacity: number; refillRate: number }
  );

  // Consomme `tokens` jetons pour la clé `key`.
  // Retourne le résultat. Lance InternalError si le store échoue.
  async consume(key: string, tokens?: number): Promise<ConsumeResult>;
}
```

### Logique de `consume()`

```
1. store.get(key)
   - null → état initial : { tokens: capacity - tokens, lastRefill: now }
   - existe → refill = min(capacity, state.tokens + (now - state.lastRefill) * refillRate / 1000)
2. Si refill >= tokens :
   - state.tokens = refill - tokens
   - state.lastRefill = now
   - store.set(key, state)
   - retourne { allowed: true, remaining: state.tokens }
3. Sinon :
   - state.lastRefill = now  // on update le timestamp même si denied
   - store.set(key, state)
   - tokensManquants = tokens - refill
   - retryAfter = tokensManquants / refillRate
   - retourne { allowed: false, remaining: 0, retryAfter }
```

### Points d'attention

- `tokens` par défaut = 1. Optionnel pour permettre de consommer plusieurs jetons (ex: requêtes plus coûteuses).
- Pas de locking dans le core — c'est la responsabilité du store. L'adapter DynamoDB utilisera des `ConditionExpression` atomiques. Le store in-memory des tests peut ignorer la concurrence.
- Refill calculé en float avant arrondi. On ne perd pas de jetons par troncature.
- Si `capacity` = 0, `consume()` retourne toujours `allowed: false`.
- Si `refillRate` = 0, c'est un bucket à capacité fixe (pas de refill).

### Tests

| Cas | Assertion |
|---|---|
| Premier consume | allowed, remaining = capacity - 1 |
| Consume tout | allowed, remaining = 0 |
| Consume après épuisement | denied, retryAfter > 0 |
| Refill après délai | sleep(refillTime), consume → allowed |
| Concurrence simulée | 100 Promise.all, vérifier que la somme consommée ≤ capacity + refill |
| Clé différente = bucket différent | `consume("a")` n'affecte pas `consume("b")` |
| tokens = 0 | allowed, remaining inchangé |
| capacity = 0 | toujours denied |
| refillRate = 0 | pas de refill, bucket fixe |
| Store qui throw | InternalError propagée |

---

## 3. `jwt.ts` — Validation JWT

### Interface du port (JWKS fetcher)

```ts
interface JwksFetcher {
  getKey(kid: string): Promise<string>; // Retourne la clé publique PEM
}
```

### Interface publique

```ts
interface JwtOptions {
  issuer: string;        // "iss" attendu
  audience: string;      // "aud" attendu
  clockTolerance?: number; // secondes de tolérance sur "exp" (défaut: 0)
}

interface JwtPayload {
  sub: string;           // Subject (ID utilisateur)
  iss: string;           // Issuer
  aud: string;           // Audience
  exp: number;           // Expiration (Unix timestamp)
  iat: number;           // Issued at
  scope?: string;        // Scope optionnel
  [key: string]: unknown; // Claims custom
}

async function validateToken(
  token: string,
  options: JwtOptions,
  fetchKey: JwksFetcher
): Promise<JwtPayload>;
```

### Logique de `validateToken()`

```
1. Décoder le header sans vérifier la signature
   - Extraire "kid" → obligatoire
   - Extraire "alg" → doit être "RS256"
   - Si kid ou alg absent/invalide → UnauthorizedError

2. Récupérer la clé publique via fetchKey.getKey(kid)
   - Si le fetcher throw → InternalError (l'infra JWKS est down)
   - Si le fetcher retourne null/undefined → InternalError

3. Vérifier la signature JWT avec la clé publique
   - Si invalide → UnauthorizedError

4. Valider les claims :
   - exp : si exp < now - clockTolerance → UnauthorizedError
   - iss : si iss !== options.issuer → UnauthorizedError
   - aud : si aud !== options.audience → UnauthorizedError
   - sub : doit être présent et non vide → UnauthorizedError

5. Retourner le payload complet
```

### Points d'attention

- Dépendance runtime : `jsonwebtoken` (ou une alternative plus légère). C'est la SEULE dépendance externe avec Zod. À bundler.
- `clockTolerance` : utile pour les serveurs légèrement désynchronisés. Défaut 0 = pas de tolérance.
- Le `kid` dans le header JWT est obligatoire. Sans `kid`, on ne sait pas quelle clé JWKS chercher.
- `validateToken` ne fait PAS de cache — le cache est dans l'adapter JWKS (`JwksFetcher`).
- Les erreurs sont toutes des `AppError` — le handler peut faire `error.toLambdaResponse()` directement.

### Tests

| Cas | Assertion |
|---|---|
| Token valide | Retourne le payload complet |
| Token expiré | UnauthorizedError, message contient "expired" |
| Mauvaise signature | UnauthorizedError, message contient "signature" |
| iss invalide | UnauthorizedError |
| aud invalide | UnauthorizedError |
| Header sans kid | UnauthorizedError |
| Header avec alg != RS256 | UnauthorizedError |
| JWKS fetcher qui throw | InternalError |
| JWKS fetcher qui retourne null | InternalError |
| clockTolerance (exp à -4s, tolérance 5s) | Accepté |
| clockTolerance (exp à -6s, tolérance 5s) | UnauthorizedError |
| Payload avec claims custom | Claims customs présents dans le retour |

---

## 4. `validation.ts` — Validation Zod

### Interface publique

```ts
function validate<T>(
  schema: ZodSchema<T>,
  data: unknown,
  options?: { source?: string } // "body", "query", "headers" — pour le message d'erreur
): T;
```

### Logique

```
1. schema.safeParse(data)
2. Si success → retourne data typé
3. Si erreur → ValidationError avec details = error.flatten()
```

### Points d'attention

- `data` est `unknown` — le handler reçoit du JSON parsé et ne sait pas ce que c'est.
- `source` optionnel : si fourni, le message d'erreur inclut la source (ex: "Request body validation failed"). Utile quand on valide plusieurs parties de la requête.
- Zod est la seule dépendance runtime externe avec `jsonwebtoken`. Tout le reste est du code maison.
- Pas de schémas métier dans ce module — juste le wrapper. Les schémas spécifiques vivent dans les handlers ou dans `src/types/`.

### Tests

| Cas | Assertion |
|---|---|
| Données valides | Retourne les données typées |
| Données invalides | ValidationError avec détails |
| Source fournie | Message contient la source |
| Schéma complexe (nested, arrays) | Valide correctement |
| undefined / null | ValidationError (sauf si le schéma les autorise) |

---

## 5. `index.ts` — Surface publique

```ts
export { AppError, UnauthorizedError, ThrottledError, ValidationError, InternalError } from "./errors";
export { RateLimiter } from "./rate-limiter";
export type { RateLimiterStore, BucketState, ConsumeResult } from "./rate-limiter";
export { validateToken } from "./jwt";
export type { JwksFetcher, JwtOptions, JwtPayload } from "./jwt";
export { validate } from "./validation";
```

Rien d'autre n'est exporté. Les détails d'implémentation restent privés.

---

## Structure du package npm

```
@julienchapron/api-gateway-core/
├── package.json          # name, version, main, types, files, bundle size limit
├── tsconfig.json         # strict, declaration true, ESM output
├── README.md             # API docs + exemples
├── src/
│   ├── index.ts
│   ├── errors.ts
│   ├── rate-limiter.ts
│   ├── jwt.ts
│   └── validation.ts
├── tests/
│   ├── errors.test.ts
│   ├── rate-limiter.test.ts
│   ├── jwt.test.ts
│   └── validation.test.ts
└── dist/                 # Build output (gitignoré, publié sur npm)
```

---

## Ordre d'implémentation conseillé

```
errors.ts → rate-limiter.ts → jwt.ts → validation.ts → index.ts
```

1. **errors.ts** d'abord : tout le monde en dépend, et c'est le plus simple.
2. **rate-limiter.ts** ensuite : le plus gros morceau. Dépend d'`InternalError`.
3. **jwt.ts** : dépend d'`UnauthorizedError` et `InternalError`.
4. **validation.ts** : dépend de `ValidationError` et de Zod.
5. **index.ts** : dernier, quand tout est stable.

Chaque module est testable indépendamment dès qu'il est écrit.
