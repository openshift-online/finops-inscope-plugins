# FinOps Backstage

This repo is a [Backstage](https://backstage.io) developer portal wired for **FinOps**: a frontend plugin (`@internal/backstage-plugin-finops`) and a backend plugin (`@internal/backstage-plugin-finops-backend`) that expose CRA-style cost and scope views. The backend talks to **Snowflake** using key-pair auth; connection details live under `finops:` in [`app-config.yaml`](app-config.yaml) (account, user, warehouse, database, schema, role, and table names).

## Prerequisites

- **Node.js** 22 or 24 (see root `package.json` `engines`).
- **Yarn** 4 (Berry) — the repo pins `packageManager` in `package.json`.
- A **Snowflake private key** (`.p8`) on disk for the app user configured in `app-config.yaml`.

## Snowflake key (required before start)

The backend reads the key path from `finops.snowflake.privateKeyPath`, which resolves `${SNOWFLAKE_PRIVATE_KEY_PATH}`. Export it in every shell where you run the app:

```sh
export SNOWFLAKE_PRIVATE_KEY_PATH=$HOME/.secrets/finops/snowflake_sandox_private_key.p8
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
