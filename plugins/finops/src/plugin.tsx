import {
  createFrontendPlugin,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';

import { rootRouteRef } from './routes';

export const finopsPage = PageBlueprint.make({
  name: 'landing',
  params: {
    path: '/finops',
    title: 'FinOps',
    routeRef: rootRouteRef,
    loader: () =>
      import('./components/FinOpsPage').then(m => (
        <m.FinOpsLandingPage />
      )),
  },
});

export const finopsCraPage = PageBlueprint.make({
  name: 'cra',
  params: {
    path: '/finops/cra',
    title: 'FinOps Cloud Resources Attribution',
    loader: () =>
      import('./components/FinOpsCRAPage').then(m => (
        <m.FinOpsCRAPage />
      )),
  },
});

export const finopsRosaPage = PageBlueprint.make({
  name: 'rosa',
  params: {
    path: '/finops/rosa',
    title: 'FinOps ROSA',
    loader: () =>
      import('./components/FinOpsPage').then(m => (
        <m.FinOpsROSAPage />
      )),
  },
});

export const finopsPlugin = createFrontendPlugin({
  pluginId: 'finops',
  extensions: [finopsPage, finopsCraPage, finopsRosaPage],
  routes: {
    root: rootRouteRef,
  },
});
