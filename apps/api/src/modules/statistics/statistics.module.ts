import { Module } from '@nestjs/common';
import { RuleVersionsModule } from '../rule-versions/rule-versions.module.js';
import { StatisticsController } from './statistics.controller.js';
import { StatisticsService } from './statistics.service.js';

@Module({ imports: [RuleVersionsModule], controllers: [StatisticsController], providers: [StatisticsService] })
export class StatisticsModule {}
