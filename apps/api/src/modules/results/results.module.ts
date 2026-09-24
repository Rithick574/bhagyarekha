import { Module } from '@nestjs/common';
import { ResultReadService } from './result-read.service.js';
import { ResultsController } from './results.controller.js';
import { ResultsRepository } from './results.repository.js';

@Module({
  controllers: [ResultsController],
  providers: [ResultsRepository, ResultReadService],
  exports: [ResultReadService],
})
export class ResultsModule {}
