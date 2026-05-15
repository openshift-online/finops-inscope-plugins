import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import finopsPlugin from '@internal/backstage-plugin-finops';
import { navModule } from './modules/nav';

export default createApp({
  features: [catalogPlugin, finopsPlugin, navModule],
});
