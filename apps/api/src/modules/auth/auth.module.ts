import { Global, Module } from '@nestjs/common';
import { AdminSessionService } from './admin-session.service.js';
import { AuthController } from './auth.controller.js';
import { CsrfGuard, OriginGuard, RolesGuard, SessionGuard } from './guards.js';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AdminSessionService, SessionGuard, CsrfGuard, RolesGuard, OriginGuard],
  exports: [AdminSessionService, SessionGuard, CsrfGuard, RolesGuard, OriginGuard],
})
export class AuthModule {}
