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
