# FinOps Dynamic Plugins Repository

This repository stores **both source plugins** (frontend and backend) and
builds new `.tgz` dynamic plugin artifacts on each push to `main`.

## Layout

- `plugins/frontend`: FinOps frontend plugin source.
- `plugins/backend`: FinOps backend plugin source.
- `dynamic-plugins.example.yaml`: Example RHDH plugin configuration.
- `.github/workflows/build-release.yml`: CI that builds and publishes `.tgz` release assets.

## Release Automation

On every push to `main`, GitHub Actions will:

1. Build/export frontend dynamic plugin.
2. Build/export backend dynamic plugin.
3. Pack each into `.tgz`.
4. Create a GitHub Release and attach both artifacts.

Each run creates a new release tag: `build-<run_number>`.
