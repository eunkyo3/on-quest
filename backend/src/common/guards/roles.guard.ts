import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AppRole } from '../roles';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { QuestJwtUser } from '../../quest/quest-auth.types';

/**
 * @Roles(...) 로 지정된 역할만 통과시키는 가드.
 *
 * 역할 판정은 req.user.role 로 한다. JwtStrategy 가 매 요청마다 DB에서
 * 최신 role 을 읽어 채우므로(즉시 무효화), 승격/강등이 토큰 만료를 기다리지 않고
 * 다음 요청부터 바로 반영된다.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AppRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<{ user?: QuestJwtUser }>();
    const role = req.user?.role;
    if (!role || !(required as string[]).includes(role)) {
      throw new ForbiddenException('접근 권한이 없습니다.');
    }
    return true;
  }
}
