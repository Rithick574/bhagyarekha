import { type DynamicModule, Global, Module } from '@nestjs/common';
import { Clock } from '../common/clock.js';
import { ENV } from './env.provider.js';
import type { Env } from './env.js';

export interface ConfigModuleOptions {
  env: Env;
  /** Time source; tests inject a FixedClock so "today" is deterministic. */
  clock?: Clock;
}

/** Global providers for validated configuration and the time source. */
@Global()
@Module({})
export class ConfigModule {
  static forRoot(options: ConfigModuleOptions): DynamicModule {
    return {
      module: ConfigModule,
      providers: [
        { provide: ENV, useValue: options.env },
        { provide: Clock, useValue: options.clock ?? new Clock() },
      ],
      exports: [ENV, Clock],
    };
  }
}
