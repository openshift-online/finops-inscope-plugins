#!/usr/bin/env bash
# Mirrors .github/workflows/release-dynamic-plugins.yml (without GitHub Release).
# Run from repo root: ./scripts/package-dynamic-plugins.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Installing dependencies and generating declaration files"
corepack enable
yarn install --immutable
yarn tsc

echo "==> Building frontend dynamic plugin"
mkdir -p dist
yarn workspace @internal/backstage-plugin-finops build
(
  cd plugins/finops
  npx @red-hat-developer-hub/cli@latest plugin export
  cd dist-dynamic
  npm pack
  mv *.tgz "$ROOT/dist/backstage-finops-frontend.tgz"
)

echo "==> Building backend dynamic plugin"
yarn workspace @internal/backstage-plugin-finops-backend build
(
  cd plugins/finops-backend
  npx @red-hat-developer-hub/cli@latest plugin export
  cd dist-dynamic
  npm pack
  mv *.tgz "$ROOT/dist/backstage-finops-backend.tgz"
)

echo "==> Writing checksums and SRI integrity"
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum dist/backstage-finops-frontend.tgz > dist/backstage-finops-frontend.tgz.sha256
  sha256sum dist/backstage-finops-backend.tgz > dist/backstage-finops-backend.tgz.sha256
else
  shasum -a 256 dist/backstage-finops-frontend.tgz > dist/backstage-finops-frontend.tgz.sha256
  shasum -a 256 dist/backstage-finops-backend.tgz > dist/backstage-finops-backend.tgz.sha256
fi
echo -n "sha256-$(openssl dgst -sha256 -binary dist/backstage-finops-frontend.tgz | openssl base64 -A)" > dist/backstage-finops-frontend.tgz.integrity.txt
echo -n "sha256-$(openssl dgst -sha256 -binary dist/backstage-finops-backend.tgz | openssl base64 -A)" > dist/backstage-finops-backend.tgz.integrity.txt

echo ""
echo "Done. Artifacts in dist/:"
ls -la dist/backstage-finops-*

echo ""
echo "SRI integrity (paste into dynamic-plugins config):"
echo "  frontend: $(cat dist/backstage-finops-frontend.tgz.integrity.txt)"
echo "  backend:  $(cat dist/backstage-finops-backend.tgz.integrity.txt)"
