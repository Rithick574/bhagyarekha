import { Module } from '@nestjs/common';
import { ResultsModule } from '../results/results.module.js';
import { RuleVersionsModule } from '../rule-versions/rule-versions.module.js';
import { TicketCheckController } from './ticket-check.controller.js';
import { TicketCheckService } from './ticket-check.service.js';

@Module({
  imports: [ResultsModule, RuleVersionsModule],
  controllers: [TicketCheckController],
  providers: [TicketCheckService],
})
export class TicketCheckModule {}
