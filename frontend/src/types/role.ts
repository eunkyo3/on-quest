export const ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  EMPLOYEE: 'employee',
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABEL: Record<string, string> = {
  [ROLES.SUPERADMIN]: '슈퍼관리자',
  [ROLES.ADMIN]: '관리자',
  [ROLES.EMPLOYEE]: '신입사원',
};

export function homePathForRole(role: string | undefined): string {
  if (role === ROLES.SUPERADMIN) return '/superadmin';
  if (role === ROLES.ADMIN) return '/admin';
  return '/employee';
}

/** 역할이 접근 가능한 경로 prefix 목록 (/settings 는 인증된 모든 역할 허용) */
export function allowedPathPrefixes(role: string | undefined): string[] {
  if (role === ROLES.SUPERADMIN) return ['/superadmin', '/admin', '/settings'];
  if (role === ROLES.ADMIN) return ['/admin', '/settings'];
  if (role === ROLES.EMPLOYEE) return ['/employee', '/settings'];
  return [];
}

/** 해당 역할이 path 에 접근 가능한지 — 로그인 후 복귀 경로 보정에 사용 */
export function canAccessPath(role: string | undefined, path: string): boolean {
  return allowedPathPrefixes(role).some((p) => path.startsWith(p));
}
