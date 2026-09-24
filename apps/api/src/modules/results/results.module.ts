import { Module } from '@nestjs/common';
import { RuleVersionsModule } from '../rule-versions/rule-versions.module.js';
import { ResultReadService } from './result-read.service.js';
import { ResultsController } from './results.controller.js';
import { ResultsRepository } from './results.repository.js';

@Module({
  imports: [RuleVersionsModule],
  controllers: [ResultsController],
  providers: [ResultsRepository, ResultReadService],
  exports: [ResultReadService, ResultsRepository],
})
export class ResultsModule {}
