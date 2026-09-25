import { Controller, Get, Query } from '@nestjs/common';
import { SkipThrottle } from '../../vendor/throttler.js';
import { StatisticsQuerySchema, type StatisticsQuery, type StatisticsResponse } from '@bhagyarekha/contracts';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { StatisticsService } from './statistics.service.js';

/** Costly aggregate; governed by the 'stats' throttler only. */
@SkipThrottle({ default: true, check: true })
@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statistics: StatisticsService) {}

  @Get()
  get(@Query(new ZodValidationPipe(StatisticsQuerySchema)) query: StatisticsQuery): Promise<StatisticsResponse> {
    return this.statistics.compute(query);
  }
}
