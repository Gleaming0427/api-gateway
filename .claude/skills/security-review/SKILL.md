---
name: security-review
description: Complete a security review of pending changes on the current branch. Review code for OWASP Top 10, AWS IAM, JWT/auth, rate limiting bypasses, secret management, and injection vectors. Activate when user asks "sécurité", "security review", "audit sécurité", or wants to validate code before deployment.
---

# Security Review — API Gateway HA pour SaaS B2B

Audit de sécurité systématique pour chaque changement de code. Le scope : les fichiers modifiés dans la branche courante. L'objectif : trouver les vulnérabilités avant qu'elles n'atteignent la production.

## 1. Authentication & JWT

- [ ] Le token JWT est-il validé AVANT toute logique métier ?
- [ ] Signature vérifiée avec l'algorithme attendu (RS256 uniquement, pas de `none`, pas de HS256 avec clé publique) ?
- [ ] Claims standards validés : `exp` (expiration), `iss` (issuer), `aud` (audience), `sub` (subject non vide) ?
- [ ] Le `kid` dans le header JWT est-il obligatoire ? Pas de fallback si absent ?
- [ ] Pas de clé secrète en dur — tout passe par `JwksFetcher` ou `sst.Secret` ?
- [ ] Cache JWKS avec TTL pour éviter le re-fetch à chaque requête (sinon DoS potentiel sur le endpoint JWKS) ?
- [ ] L'authorizer Lambda refuse explicitement (`isAuthorized: false`) les tokens invalides, sans exception ?

## 2. Rate Limiting

- [ ] Le rate limiting est-il appliqué AVANT le proxy vers le backend (pas après coup) ?
- [ ] L'identité pour le bucket est-elle non-spoofable (API key ou `sub` JWT, pas IP) ?
- [ ] Le store (DynamoDB) est-il protégé contre les race conditions (ConditionExpression atomique, pas de get-then-set sans verrou) ?
- [ ] Le header `Retry-After` est-il toujours présent sur les 429 ?
- [ ] Pas de bypass possible via header custom ou paramètre ?
- [ ] Les tokens consommés sont-ils proportionnels au coût réel de la requête (pas 1 token pour un upload de 100 MB comme pour un GET) ?

## 3. Input Validation & Injection

- [ ] Tous les inputs externes sont-ils validés AVANT utilisation (body, query string, headers, path params) ?
- [ ] Validation via Zod ou schéma explicite, pas de parsing artisanal ?
- [ ] Pas de concaténation d'input utilisateur dans des requêtes DynamoDB (NoSQL injection via UpdateExpression ou FilterExpression) ?
- [ ] Pas d'eval, Function(), ou `vm.runInNewContext()` sur des inputs ?
- [ ] Pas de vulnérabilité HTTP header injection (pas de `\r\n` dans les headers) ?
- [ ] Pas de XML External Entity (XXE) si le body est XML ?
- [ ] Content-Type vérifié avant de parser le body ?

## 4. Secrets & Configuration

- [ ] Zéro secret en dur dans le code (clés API, tokens, private keys, mots de passe) ?
- [ ] Les secrets sont dans AWS Secrets Manager, accédés via `sst.Secret` ?
- [ ] Pas de secret loggé (cloudwatch, console.log, error messages) ?
- [ ] Les variables d'environnement Lambda ne contiennent pas de secrets ?
- [ ] `.env` et `.env.local` dans `.gitignore` ?

## 5. IAM & AWS

- [ ] Principe du moindre privilège : les roles IAM sont limités aux actions et ressources strictement nécessaires ?
- [ ] Pas de `"Resource": "*"` avec `"Action": "*"` ?
- [ ] DynamoDB : accès limité à la table spécifique (pas `"Resource": "arn:aws:dynamodb:*:*:table/*"`) ?
- [ ] Pas de permissions `iam:PassRole` sans restriction ?
- [ ] Lambda : pas d'accès à Secrets Manager pour toutes les secrets, seulement ceux du projet ?
- [ ] CloudWatch Logs : pas de données sensibles loggées ?

## 6. Dependency & Supply Chain

- [ ] Pas de nouvelle dépendance sans vérification (âge, maintenance, vulnérabilités connues, taille) ?
- [ ] `npm audit` passe sans vulnérabilité critique/high ?
- [ ] Les dépendances sont-elles pinées (version exacte, pas `^` ou `~`) ?
- [ ] Pas de dépendance qui lit les fichiers locaux ou le network sans raison ?
- [ ] La taille de chaque dépendance est-elle justifiée (pas un package de 2 MB pour une fonction utilitaire) ?

## 7. Data Exposure & Error Handling

- [ ] Les messages d'erreur ne fuient pas d'information (pas de stack trace en prod, pas de détails internes dans la réponse) ?
- [ ] Les erreurs 5XX logguent le détail mais retournent un message générique au client ?
- [ ] Les erreurs 4XX retournent un `code` machine + un message humain, sans exposer la logique interne ?
- [ ] Pas d'information de debug dans les réponses de prod (flags, versions, chemins de fichiers) ?
- [ ] Les headers de réponse ne contiennent pas `Server`, `X-Powered-By`, `X-Amzn-Trace-Id` ?

## 8. Transport & Network

- [ ] API Gateway configuré en HTTPS uniquement (pas de HTTP) ?
- [ ] Certificat ACM valide, TLS 1.2 minimum ?
- [ ] Pas de requêtes sortantes vers des endpoints non fiables sans validation ?
- [ ] Webhook signatures vérifiées si applicable (HMAC) ?
- [ ] Timeout HTTP configuré sur les appels externes (pas de connexion bloquée indéfiniment) ?

## Output

À la fin, produire un récap :

```
🔐 Security Review — [fichiers ou scope analysés]

✅ Conforme : [N/X catégories]
⚠️  Attention : [catégorie] — [détail du risque, sans suggestion de correctif si c'est un faux positif]
🔴 Bloquant : [catégorie] — [CVE potentielle ou vulnérabilité confirmée]

Verdict : [✅ Ready / ⚠️ Deployable with caution / 🔴 Do not deploy]
```

Si verdict "🔴 Do not deploy", lister les actions correctives AVANT de considérer le code comme livrable.

Ne pas faire de supposition sur le comportement d'AWS — vérifier la documentation si un doute existe.
