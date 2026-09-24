import { Module } from '@nestjs/common';
import { PublishingModule } from '../publishing/publishing.module.js';
import { RuleVersionsModule } from '../rule-versions/rule-versions.module.js';
import { ImportsController } from './imports.controller.js';
import { ImportsService } from './imports.service.js';

@Module({
  imports: [RuleVersionsModule, PublishingModule],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}
