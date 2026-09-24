import { Module } from '@nestjs/common';
import { RuleLoaderService } from './rule-loader.service.js';

@Module({
  providers: [RuleLoaderService],
  exports: [RuleLoaderService],
})
export class RuleVersionsModule {}
