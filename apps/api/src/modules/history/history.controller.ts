import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { SkipThrottle } from '../../vendor/throttler.js';
import { HistorySearchRequestSchema, type HistorySearchRequest, type HistorySearchResponse } from '@bhagyarekha/contracts';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { HistoryService } from './history.service.js';

/** POST so the searched number stays out of URLs and access logs; governed by the 'check' throttler like ticket checks. */
@SkipThrottle({ default: true, stats: true })
@Controller('history')
export class HistoryController {
  constructor(private readonly history: HistoryService) {}

  @Post('search')
  @HttpCode(200)
  search(@Body(new ZodValidationPipe(HistorySearchRequestSchema)) body: HistorySearchRequest): Promise<HistorySearchResponse> {
    return this.history.search(body);
  }
}
