import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES } from '../roles';

function makeContext(userRole: string | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: userRole ? { role: userRole } : undefined }),
    }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

function makeGuard(required: string[] | undefined): RolesGuard {
  const reflector = {
    getAllAndOverride: () => required,
  } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  it('역할 요구가 없으면 통과', () => {
    const guard = makeGuard(undefined);
    expect(guard.canActivate(makeContext(ROLES.EMPLOYEE))).toBe(true);
  });

  it('요구 역할에 해당하면 통과', () => {
    const guard = makeGuard([ROLES.ADMIN, ROLES.SUPERADMIN]);
    expect(guard.canActivate(makeContext(ROLES.SUPERADMIN))).toBe(true);
  });

  it('요구 역할이 아니면 차단', () => {
    const guard = makeGuard([ROLES.SUPERADMIN]);
    expect(() => guard.canActivate(makeContext(ROLES.ADMIN))).toThrow(
      ForbiddenException,
    );
  });

  it('인증 사용자 정보가 없으면 차단', () => {
    const guard = makeGuard([ROLES.ADMIN]);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
