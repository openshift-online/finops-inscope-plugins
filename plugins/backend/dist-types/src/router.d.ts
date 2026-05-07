import { Router } from 'express';
import { LoggerService } from '@backstage/backend-plugin-api';
import { FinopsRepository } from './repository';
export declare function createFinopsRouter(options: {
    repository: FinopsRepository;
    logger: LoggerService;
}): Router;
