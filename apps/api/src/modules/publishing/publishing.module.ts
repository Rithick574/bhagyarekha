import { Module } from '@nestjs/common';
import { RuleVersionsModule } from '../rule-versions/rule-versions.module.js';
import { PublishingController } from './publishing.controller.js';
import { PublishingService } from './publishing.service.js';
import { RevisionReadService } from './revision-read.service.js';

@Module({
  imports: [RuleVersionsModule],
  controllers: [PublishingController],
  providers: [RevisionReadService, PublishingService],
  exports: [RevisionReadService, PublishingService],
})
export class PublishingModule {}
