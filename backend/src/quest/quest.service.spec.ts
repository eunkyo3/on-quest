import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { QuestService, csvEscape } from './quest.service';
import { QuestStatus } from './enums/quest-status.enum';
import { ROLES } from '../common/roles';
import type { QuestJwtUser } from './quest-auth.types';

const COMPANY = 'ACME';
const ASSIGNEE = 'UEMP0001';

function makeQuest(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date('2026-06-10T00:00:00.000Z');
  return {
    id: 'q1234567',
    title: '온보딩 과제',
    description: '설명',
    deadline: now,
    status: QuestStatus.PENDING,
    feedback: null,
    declineReason: null,
    proofFileName: null,
    proofMimeType: null,
    submissionNote: null,
    assigneeId: ASSIGNEE,
    reviewerId: null,
    publisherSlackMemberId: 'UADMIN01',
    companyCode: COMPANY,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function setup(quest: ReturnType<typeof makeQuest>) {
  const prisma = {
    quest: {
      findUnique: jest.fn().mockResolvedValue(quest),
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...quest, ...data }),
        ),
      update: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...quest, ...data }),
        ),
    },
    user: {
      findFirst: jest.fn().mockResolvedValue({ id: 'u1' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  const n8n = { triggerWebhook: jest.fn() };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const config = { get: jest.fn().mockReturnValue(undefined) };
  const service = new QuestService(
    prisma as never,
    n8n as never,
    config as never,
    audit as never,
  );
  return { service, prisma, n8n, audit };
}

const employee: QuestJwtUser = {
  sub: 'e1',
  email: 'e@a.com',
  name: '사원',
  role: ROLES.EMPLOYEE,
  companyCode: COMPANY,
  slackMemberId: ASSIGNEE,
};
const admin: QuestJwtUser = {
  sub: 'a1',
  email: 'a@a.com',
  name: '관리자',
  role: ROLES.ADMIN,
  companyCode: COMPANY,
  slackMemberId: 'UADMIN01',
};

describe('QuestService — 거부(decline)', () => {
  it('담당자가 대기 상태 퀘스트를 사유와 함께 거부 → DECLINED', async () => {
    const { service, n8n, audit } = setup(makeQuest({ status: QuestStatus.PENDING }));
    const res = await service.declineQuest('q1234567', { reason: '담당 불가' }, employee);
    expect(res.status).toBe(QuestStatus.DECLINED);
    expect(res.declineReason).toBe('담당 불가');
    expect(n8n.triggerWebhook).toHaveBeenCalledWith('quest.declined', expect.any(Object));
    expect(audit.record).toHaveBeenCalled();
  });

  it('담당자가 아니면 거부 불가(Forbidden)', async () => {
    const { service } = setup(makeQuest({ assigneeId: 'OTHER999' }));
    await expect(
      service.declineQuest('q1234567', { reason: 'x' }, employee),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('이미 제출된(검토 대기) 퀘스트는 거부 불가(BadRequest)', async () => {
    const { service } = setup(makeQuest({ status: QuestStatus.SUBMITTED }));
    await expect(
      service.declineQuest('q1234567', { reason: 'x' }, employee),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('QuestService — 검토(review)', () => {
  it('사원은 검토 불가(Forbidden)', async () => {
    const { service } = setup(makeQuest({ status: QuestStatus.SUBMITTED }));
    await expect(
      service.reviewQuest('q1234567', { status: QuestStatus.COMPLETED }, employee),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('반려 시 피드백이 없으면 거부(BadRequest)', async () => {
    const { service } = setup(makeQuest({ status: QuestStatus.SUBMITTED }));
    await expect(
      service.reviewQuest('q1234567', { status: QuestStatus.REJECTED }, admin),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('관리자가 검토 대기 퀘스트를 승인 → COMPLETED', async () => {
    const { service } = setup(makeQuest({ status: QuestStatus.SUBMITTED }));
    const res = await service.reviewQuest(
      'q1234567',
      { status: QuestStatus.COMPLETED },
      admin,
    );
    expect(res.status).toBe(QuestStatus.COMPLETED);
  });
});

describe('QuestService — 재개봉(reopen)', () => {
  it('관리자가 거부됨 퀘스트를 재개봉 → PENDING, 사유 제거', async () => {
    const { service } = setup(makeQuest({ status: QuestStatus.DECLINED, declineReason: '불가' }));
    const res = await service.reopenQuest('q1234567', {}, admin);
    expect(res.status).toBe(QuestStatus.PENDING);
    expect(res.declineReason).toBeNull();
  });

  it('거부됨 상태가 아니면 재개봉 불가(BadRequest)', async () => {
    const { service } = setup(makeQuest({ status: QuestStatus.PENDING }));
    await expect(
      service.reopenQuest('q1234567', {}, admin),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('재개봉하며 다른 사원으로 재배정', async () => {
    const { service, prisma } = setup(
      makeQuest({ status: QuestStatus.DECLINED, assigneeId: ASSIGNEE }),
    );
    const res = await service.reopenQuest(
      'q1234567',
      { assigneeId: 'UEMP0002' },
      admin,
    );
    expect(prisma.user.findFirst).toHaveBeenCalled();
    expect(res.assigneeId).toBe('UEMP0002');
    expect(res.status).toBe(QuestStatus.PENDING);
  });
});

describe('QuestService — 일괄 발행(bulk)', () => {
  const future = new Date(Date.now() + 86_400_000);

  function setupBulk() {
    const quest = makeQuest();
    const ctx = setup(quest);
    // 이메일 → 사원 해석
    ctx.prisma.user.findMany = jest.fn().mockResolvedValue([
      { email: 'e1@a.com', slackMemberId: 'UEMP0001' },
      { email: 'e2@a.com', slackMemberId: 'UEMP0002' },
    ]);
    // $transaction: create 프로미스 배열을 그대로 실행
    (ctx.prisma as Record<string, unknown>).$transaction = jest
      .fn()
      .mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops));
    ctx.prisma.quest.create = jest
      .fn()
      .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...quest, ...data }),
      );
    return ctx;
  }

  it('모든 이메일이 해석되면 전건 생성 + 감사 로그', async () => {
    const { service, n8n, audit } = setupBulk();
    const res = await service.bulkCreateQuests(
      {
        items: [
          { title: '과제 1', description: 'd', deadline: future, assigneeEmail: 'e1@a.com' },
          { title: '과제 2', description: 'd', deadline: future, assigneeEmail: 'e2@a.com' },
        ],
      },
      admin,
    );
    expect(res.created).toBe(2);
    expect(n8n.triggerWebhook).toHaveBeenCalledTimes(2);
    expect(audit.record).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({ action: 'quest.bulk_created' }),
    );
  });

  it('미등록 이메일이 있으면 행 번호와 함께 전체 거부', async () => {
    const { service } = setupBulk();
    await expect(
      service.bulkCreateQuests(
        {
          items: [
            { title: '과제 1', description: 'd', deadline: future, assigneeEmail: 'e1@a.com' },
            { title: '과제 2', description: 'd', deadline: future, assigneeEmail: 'ghost@a.com' },
          ],
        },
        admin,
      ),
    ).rejects.toThrow(/2행\(ghost@a\.com\)/);
  });

  it('사원은 일괄 발행 불가(Forbidden)', async () => {
    const { service } = setupBulk();
    await expect(
      service.bulkCreateQuests(
        { items: [{ title: '과제', description: 'd', deadline: future, assigneeEmail: 'e1@a.com' }] },
        employee,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('csvEscape', () => {
  it('일반 문자열은 그대로', () => {
    expect(csvEscape('hello')).toBe('hello');
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
  });

  it('콤마·따옴표·줄바꿈은 따옴표로 감싸고 따옴표는 이중화', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
  });
});
