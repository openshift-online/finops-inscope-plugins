import { Router } from 'express';
import { LoggerService } from '@backstage/backend-plugin-api';
import { FinopsRepository, normalizeGrain, validateMetric } from './repository';

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function assertDateRange(fromDate: string, toDate: string): void {
  if (!isIsoDate(fromDate) || !isIsoDate(toDate)) {
    throw new Error('Invalid range: expected YYYY-MM-DD');
  }
  if (fromDate > toDate) {
    throw new Error('Invalid range: from must be <= to');
  }
}

function detail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isBadRequest(error: unknown): boolean {
  const message = detail(error);
  return (
    message.startsWith('Invalid range:') ||
    message.startsWith('Invalid metric:') ||
    message.startsWith('Invalid grain:')
  );
}

export function createFinopsRouter(options: {
  repository: FinopsRepository;
  logger: LoggerService;
}): Router {
  const { repository, logger } = options;
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  router.get('/api/teams', async (_req, res) => {
    try {
      res.json(await repository.listTeams());
    } catch (error) {
      logger.error(`Failed to fetch teams: ${detail(error)}`);
      res.status(500).json({ detail: 'Failed to fetch teams' });
    }
  });

  router.get('/api/scopes', async (req, res) => {
    const team = typeof req.query.team === 'string' ? req.query.team : null;
    try {
      res.json(await repository.listScopes(team));
    } catch (error) {
      logger.error(`Failed to fetch scopes: ${detail(error)}`);
      res.status(500).json({ detail: 'Failed to fetch scopes' });
    }
  });

  router.get('/api/scope-teams-batch', async (req, res) => {
    const raw = req.query.scope_slug;
    let scopeSlugs: string[] = [];
    if (Array.isArray(raw)) {
      scopeSlugs = raw.filter((v): v is string => typeof v === 'string');
    } else if (typeof raw === 'string') {
      scopeSlugs = [raw];
    }
    if (scopeSlugs.length === 0) {
      res.json([]);
      return;
    }

    try {
      res.json(await repository.listTeamsForScopes(scopeSlugs));
    } catch (error) {
      logger.error(`Failed to fetch scope team batch: ${detail(error)}`);
      res.status(500).json({ detail: 'Failed to fetch scope team batch' });
    }
  });

  router.get('/api/trends', async (req, res) => {
    const fromDate = typeof req.query.from === 'string' ? req.query.from : '';
    const toDate = typeof req.query.to === 'string' ? req.query.to : '';
    const metricRaw = typeof req.query.metric === 'string' ? req.query.metric : undefined;
    const grainRaw = typeof req.query.grain === 'string' ? req.query.grain : undefined;
    const scope = typeof req.query.scope === 'string' ? req.query.scope : null;
    const team = typeof req.query.team === 'string' ? req.query.team : null;

    try {
      assertDateRange(fromDate, toDate);
      const metric = validateMetric(metricRaw);
      const grain = normalizeGrain(grainRaw);
      res.json(await repository.getTrends({ fromDate, toDate, metric, grain, scope, team }));
    } catch (error) {
      if (isBadRequest(error)) {
        res.status(400).json({ detail: detail(error) });
        return;
      }
      logger.error(`Failed to fetch trends: ${detail(error)}`);
      res.status(500).json({ detail: 'Failed to fetch trends' });
    }
  });

  router.get('/api/summary', async (req, res) => {
    const fromDate = typeof req.query.from === 'string' ? req.query.from : '';
    const toDate = typeof req.query.to === 'string' ? req.query.to : '';
    const metricRaw = typeof req.query.metric === 'string' ? req.query.metric : undefined;
    const scope = typeof req.query.scope === 'string' ? req.query.scope : null;
    const team = typeof req.query.team === 'string' ? req.query.team : null;

    try {
      assertDateRange(fromDate, toDate);
      const metric = validateMetric(metricRaw);
      res.json(await repository.getSummary({ fromDate, toDate, metric, scope, team }));
    } catch (error) {
      if (isBadRequest(error)) {
        res.status(400).json({ detail: detail(error) });
        return;
      }
      logger.error(`Failed to fetch summary: ${detail(error)}`);
      res.status(500).json({ detail: 'Failed to fetch summary' });
    }
  });

  return router;
}
