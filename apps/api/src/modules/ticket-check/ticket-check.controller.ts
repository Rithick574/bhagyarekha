import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { TicketCheckRequestSchema, type TicketCheckRequest, type TicketCheckResponse } from '@bhagyarekha/contracts';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { TicketCheckService } from './ticket-check.service.js';

/** POST-only so the ticket never appears in a URL, proxy log or browser history. Governed by the stricter 'check' throttler. */
@SkipThrottle({ default: true })
@Controller('ticket-check')
export class TicketCheckController {
  constructor(private readonly service: TicketCheckService) {}

  @Post()
  @HttpCode(200)
  check(@Body(new ZodValidationPipe(TicketCheckRequestSchema)) body: TicketCheckRequest): Promise<TicketCheckResponse> {
    return this.service.check(body);
  }
}
