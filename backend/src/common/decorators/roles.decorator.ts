import { SetMetadata } from '@nestjs/common';
import type { AppRole } from '../roles';

export const ROLES_KEY = 'roles';

/** 라우트에 필요한 역할을 지정한다. RolesGuard 와 함께 사용. */
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
