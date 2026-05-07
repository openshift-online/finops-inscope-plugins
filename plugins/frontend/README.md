# finops

Backstage frontend plugin for Cloud Resources Attribution (CRA).

## Route

This plugin is mounted at `http://localhost:3000/finops` (path: `/finops`).

## API configuration

The plugin fetches data through Backstage proxy:

`/api/proxy/finops/api/*` -> local Backstage backend `finops` plugin (`/api/finops/api/*`)

No external AWS-hosted CRA API is required with this setup.

## Scope Cost API contract

The upstream Scope Cost API in the `cloud-resources-attribution` webapp exposes:

- `GET /api/teams` — `id` (team config path), `name`, optional `description`, `members` with `person_id` and `role` (`manager` | `product_manager` | `team_lead`)
- `GET /api/scopes` — `scope_slug`, `scope_name`, optional query `team`: allocated scope slugs **and all nested slugs** (`child` matches `root` or `root.%`)
- `GET /api/trends` — query: `from`, `to`, `metric`, `grain`, optional `scope`, optional `team`
- `GET /api/summary` — query: `from`, `to`, `metric`, optional `scope`, optional `team`

Provider-type filtering in the Backstage UI is **client-side only** (the API does not accept `provider_types`).

The CRA page overlays **usage hours** on the cost chart. The live data source calls the trends API separately for `ec2_usage_hours_amount` and `rds_usage_hours_amount`, and renders each metric as its own usage series. The Scope Cost API `metric` query parameter accepts those column names alongside cost metrics.
