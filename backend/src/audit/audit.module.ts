import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

/** 감사 로그는 여러 모듈에서 기록하므로 전역으로 노출한다. */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
