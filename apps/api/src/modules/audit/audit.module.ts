import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service.js';
import { IdempotencyService } from './idempotency.service.js';

@Global()
@Module({
  providers: [AuditService, IdempotencyService],
  exports: [AuditService, IdempotencyService],
})
export class AuditModule {}
