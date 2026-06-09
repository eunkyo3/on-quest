import { MANAGER_ROLES, ROLES, isManagerRole } from './roles';

describe('roles', () => {
  it('관리자/슈퍼관리자는 매니저 역할', () => {
    expect(isManagerRole(ROLES.ADMIN)).toBe(true);
    expect(isManagerRole(ROLES.SUPERADMIN)).toBe(true);
  });

  it('신입사원·알 수 없는 역할은 매니저가 아님', () => {
    expect(isManagerRole(ROLES.EMPLOYEE)).toBe(false);
    expect(isManagerRole('something')).toBe(false);
    expect(isManagerRole('')).toBe(false);
  });

  it('MANAGER_ROLES 에는 employee 가 포함되지 않는다', () => {
    expect(MANAGER_ROLES).toEqual(
      expect.arrayContaining([ROLES.ADMIN, ROLES.SUPERADMIN]),
    );
    expect(MANAGER_ROLES).not.toContain(ROLES.EMPLOYEE);
  });
});
