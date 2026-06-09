/**
 * 애플리케이션 역할 단일 정의.
 * - superadmin: 회사코드 최초 가입자. 구성원 역할 관리(상위 집합).
 * - admin: 퀘스트 발행·검토.
 * - employee: 신입사원.
 */
export const ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  EMPLOYEE: 'employee',
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES];

/** 관리자 권한(퀘스트 관리)을 가지는 역할 집합 */
export const MANAGER_ROLES: AppRole[] = [ROLES.ADMIN, ROLES.SUPERADMIN];

export const isManagerRole = (role: string): boolean =>
  (MANAGER_ROLES as string[]).includes(role);
