import { AuthService } from './auth.service';
import { ROLES } from '../common/roles';

type AnyFn = jest.Mock;

function makeService() {
  const prisma = {
    user: {
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue('token') };
  const config = { get: jest.fn().mockReturnValue('1h') };
  const service = new AuthService(prisma as any, jwt as any, config as any);
  return { service, prisma };
}

const baseDto = {
  email: 'a@b.com',
  name: '홍길동',
  password: 'password123',
  slackMemberId: 'UABCDEFG1',
  companyCode: 'ACME',
};

describe('AuthService.signUp 역할 결정', () => {
  it('회사 첫 가입자는 superadmin', async () => {
    const { service, prisma } = makeService();
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.count.mockResolvedValue(0);
    (prisma.user.create as AnyFn).mockImplementation(({ data }: any) =>
      Promise.resolve({ id: '1', ...data }),
    );

    const res = await service.signUp({ ...baseDto });
    expect(res.user.role).toBe(ROLES.SUPERADMIN);
  });

  it('이후 가입자는 employee', async () => {
    const { service, prisma } = makeService();
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.count.mockResolvedValue(3);
    (prisma.user.create as AnyFn).mockImplementation(({ data }: any) =>
      Promise.resolve({ id: '2', ...data }),
    );

    const res = await service.signUp({ ...baseDto });
    expect(res.user.role).toBe(ROLES.EMPLOYEE);
  });

  it('중복 가입은 BadRequest', async () => {
    const { service, prisma } = makeService();
    prisma.user.findFirst.mockResolvedValue({ id: 'dup' });

    await expect(service.signUp({ ...baseDto })).rejects.toThrow();
  });
});
