import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { SkipThrottle } from '../../vendor/throttler.js';
import type { HealthLiveResponse, HealthReadyResponse } from '@bhagyarekha/contracts';
import type { Response } from 'express';
import { HealthService } from './health.service.js';

@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('live')
  live(): HealthLiveResponse {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response): Promise<HealthReadyResponse> {
    const body = await this.health.readiness();
    if (body.status !== 'ok') res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return body;
  }
}
