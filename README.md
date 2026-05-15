# FinOps Backstage

This repo is a [Backstage](https://backstage.io) developer portal wired for **FinOps**: a frontend plugin (`@internal/backstage-plugin-finops`) and a backend plugin (`@internal/backstage-plugin-finops-backend`) that expose CRA-style cost and scope views. The backend talks to **Snowflake** using key-pair auth; connection details live under `finops:` in [`app-config.yaml`](app-config.yaml) (account, user, warehouse, database, schema, role, and table names).

## Prerequisites

- **Node.js** 22 or 24 (see root `package.json` `engines`).
- **Yarn** 4 (Berry) — the repo pins `packageManager` in `package.json`.
- A **Snowflake private key** (`.p8`) on disk for the app user configured in `app-config.yaml`. For local development you can use the **Dataverse sandbox service account**: put that account’s key on disk and set `finops.snowflake.user` in `app-config.yaml` to match that user.

## Snowflake key (required before start)

The `.p8` file must be a **PEM-encoded PKCS#8 private key** (plain text). It should look like this:

```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
(more base64 lines)
-----END PRIVATE KEY-----
```

The backend reads the key path from `finops.snowflake.privateKeyPath`, which resolves `${SNOWFLAKE_PRIVATE_KEY_PATH}`. Export it in every shell where you run the app:

```sh
export SNOWFLAKE_PRIVATE_KEY_PATH=$HOME/.secrets/finops/snowflake_sandbox_private_key.p8
```

Adjust the path if your key file lives elsewhere.

## GitHub token (optional)

Catalog and GitHub integrations expect `GITHUB_TOKEN` in the environment if you use those features; see `integrations.github` in `app-config.yaml`.

## Run locally

`yarn start` runs the full monorepo (frontend on **http://localhost:3000**, backend on **http://localhost:7007**). The app proxies `/finops` to the FinOps API on the backend.

```sh
yarn install
yarn start
```

## Useful commands

| Command | Purpose |
|--------|---------|
| `yarn start` | Dev: app + backend via `backstage-cli repo start` |
| `yarn build:all` | Build all packages |
| `yarn build:backend` | Build only `packages/backend` |
| `yarn test` | Unit tests across the repo |
| `yarn test:e2e` | Playwright e2e tests |
| `yarn lint:all` / `yarn lint` | ESLint (all vs since `origin/main`) |

Workspace-scoped builds for FinOps plugins, for example:

```sh
yarn workspace @internal/backstage-plugin-finops build
yarn workspace @internal/backstage-plugin-finops-backend build
```

Production-oriented config overrides are in [`app-config.production.yaml`](app-config.production.yaml).

## Releasing dynamic plugins

FinOps frontend and backend plugins are published as `.tgz` dynamic plugin bundles on **semver GitHub releases** (for example `v0.2.0`). See [`dynamic-plugins.example.yaml`](dynamic-plugins.example.yaml) for how to wire them into RHDH/OpenShift.

1. Optionally bump `version` in `plugins/finops/package.json` and `plugins/finops-backend/package.json`.
2. Commit your changes on `main`.
3. Create and push a tag:
   ```sh
   git tag v0.2.0
   git push origin v0.2.0
   ```
4. GitHub Actions ([`.github/workflows/release-dynamic-plugins.yml`](.github/workflows/release-dynamic-plugins.yml)) builds both plugins, attaches artifacts to the release, and writes checksum files.

Each release includes:

| Artifact | Use |
|----------|-----|
| `backstage-finops-frontend.tgz` / `backstage-finops-backend.tgz` | `package` URL in dynamic plugin config |
| `*.integrity` | `integrity` field (`sha256-<base64>` SRI) |
| `*.sha256` | Hex checksum for manual verification |

Copy the single-line contents of `backstage-finops-frontend.tgz.integrity` and `backstage-finops-backend.tgz.integrity` into your deployment manifest (`test-extras.yml`, cluster `dynamic-plugins` CR, etc.), and set `package` URLs to `https://github.com/openshift-online/finops-inscope-plugins/releases/download/<tag>/backstage-finops-*.tgz`.

To dry-run the build locally (without publishing):

```sh
yarn build:dynamic-plugins
cd plugins/finops && yarn export-dynamic && yarn pack-dynamic
cd ../finops-backend && yarn export-dynamic && yarn pack-dynamic
```

You can compute SRI integrity for a local `.tgz` with:

```sh
echo -n "sha256-$(openssl dgst -sha256 -binary path/to/artifact.tgz | openssl base64 -A)"
```
