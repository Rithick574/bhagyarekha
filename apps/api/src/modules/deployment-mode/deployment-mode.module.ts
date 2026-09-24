import { Global, Module } from '@nestjs/common';
import { DeploymentModeService } from './deployment-mode.service.js';

@Global()
@Module({
  providers: [DeploymentModeService],
  exports: [DeploymentModeService],
})
export class DeploymentModeModule {}
