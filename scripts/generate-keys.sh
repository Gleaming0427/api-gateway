#!/usr/bin/env bash
# Generates an RSA key pair for local JWT signing and JWKS serving.
# private.pem = used by generate-token.ts to sign tokens
# public.pem  = used by dev-jwks-server.ts to serve the JWKS endpoint

set -euo pipefail
cd "$(dirname "$0")"

openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem

echo "Keys generated: private.pem (keep secret) and public.pem (safe to share)"
