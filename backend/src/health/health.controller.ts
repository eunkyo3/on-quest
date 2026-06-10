import {
  Controller,
  Get,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 컨테이너 오케스트레이션·모니터링용 헬스체크.
 * 인증 불필요(공개), 레이트리밋 제외(잦은 프로브 허용).
 * 경로: GET /api/health
 */
@Controller('health')
@SkipThrottle()
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<{ status: string; db: string; timestamp: string }> {
    let db = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = 'up';
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`헬스체크 DB 연결 실패: ${msg}`);
      throw new ServiceUnavailableException({
        status: 'error',
        db,
        timestamp: new Date().toISOString(),
      });
    }
    return { status: 'ok', db, timestamp: new Date().toISOString() };
  }
}
