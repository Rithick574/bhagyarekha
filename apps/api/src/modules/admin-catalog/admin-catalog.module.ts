import { Module } from '@nestjs/common';
import { RuleVersionsModule } from '../rule-versions/rule-versions.module.js';
import { AdminCatalogController } from './admin-catalog.controller.js';
import { AdminCatalogService } from './admin-catalog.service.js';

@Module({
  imports: [RuleVersionsModule],
  controllers: [AdminCatalogController],
  providers: [AdminCatalogService],
  exports: [AdminCatalogService],
})
export class AdminCatalogModule {}
