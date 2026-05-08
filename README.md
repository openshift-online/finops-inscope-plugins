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

## Ephemeral Environment Deployment

1. Log in to OpenShift by running the `oc login ...` command displayed at:
   `https://oauth-openshift.apps.crc-eph.r9lp.p1.openshiftapps.com/oauth/token/request`
2. Deploy Backstage in an ephemeral environment (example to keep the environment for 7h before it's teared down):
   ```bash
   bonfire deploy backstage -d 7h
   ```
3. In the deploy logs, look near the beginning for the OpenShift console URL.
   It appears in a line like:
   ```text
   2026-05-08 09:55:53 [    INFO] [          MainThread] namespace console url: https://console-openshift-console.apps.crc-eph.r9lp.p1.openshiftapps.com/k8s/cluster/projects/ephemeral-uurty2
   ```
4. Bind the Backstage service to a local port:
   ```bash
   oc port-forward services/backstage 7007:7007
   ```
5. Access Backstage locally at `http://localhost:7007`.
6. Create or update the Snowflake private key secret (kept outside this repository):
   ```bash
   oc create secret generic finops-snowflake-key \
     --from-file=private_key.p8="$HOME/.secrets/finops/snowflake_sandox_private_key.p8" \
     --dry-run=client -o yaml | oc apply -f -
   ```
   If your key file is stored elsewhere, replace the path accordingly.
7. Apply the ephemeral template resources:
   ```bash
   oc process -f template-ephemeral.yml | oc apply -f -
   ```
   Backstage will restart automatically after applying the resources, but takes a while
8. Apply the extra Backstage resources:
   ```bash
   oc process -f test-extras.yml | oc apply -f -
   ```
   Restart by scaling down/up the pod: 
   `https://console-openshift-console.apps.crc-eph.r9lp.p1.openshiftapps.com/k8s/ns/<your-ephemeral-namespace>/deployments/backstage`
9. `http://localhost:7007` should be available (you will likely need to re-execute the port-forward command of line 4)
