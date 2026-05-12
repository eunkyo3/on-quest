import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { generateQuestId } from '../common/utils/id-generator';
import { N8nService } from '../automation/n8n.service';
import { CreateQuestDto } from './dto/create-quest.dto';
import { ReviewQuestDto } from './dto/review-quest.dto';
import { QuestStatus } from './enums/quest-status.enum';
import type { QuestJwtUser } from './quest-auth.types';

const questListSelect = {
  id: true,
  title: true,
  description: true,
  deadline: true,
  status: true,
  feedback: true,
  proofFileName: true,
  proofMimeType: true,
  submissionNote: true,
  assigneeId: true,
  reviewerId: true,
  publisherSlackMemberId: true,
  companyCode: true,
  createdAt: true,
  updatedAt: true,
} as const;

type QuestListRow = {
  id: string;
  title: string;
  description: string;
  deadline: Date;
  status: number;
  feedback: string | null;
  proofFileName: string | null;
  proofMimeType: string | null;
  submissionNote: string | null;
  assigneeId: string;
  reviewerId: string | null;
  publisherSlackMemberId: string;
  companyCode: string;
  createdAt: Date;
  updatedAt: Date;
};

export interface QuestSummary {
  id: string;
  title: string;
  description: string;
  deadline: Date;
  status: QuestStatus;
  feedback: string | null;
  proofFileName: string | null;
  proofMimeType: string | null;
  hasProof: boolean;
  submissionNote: string | null;
  assigneeId: string;
  reviewerId: string | null;
  publisherSlackMemberId: string;
  companyCode: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuestProgressStats {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  rejected: number;
  completionRate: number;
}

/** 관리자용: 퀘스트가 1건 이상 배정된 담당자(Slack ID)별 집계 */
export interface AssigneeQuestStats {
  assigneeId: string;
  assigneeName: string | null;
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  rejected: number;
  completionRate: number;
}

/** 관리자용: 같은 회사 사원(담당 후보) 목록 */
export interface AssignableEmployee {
  id: string;
  name: string;
  email: string;
  slackMemberId: string;
}

@Injectable()
export class QuestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly n8n: N8nService,
  ) {}

  async createQuest(dto: CreateQuestDto, publisher: QuestJwtUser): Promise<QuestSummary> {
    if (publisher.role !== 'admin') {
      throw new ForbiddenException('퀘스트 발행은 관리자만 가능합니다.');
    }

    const assignee = await this.prisma.user.findFirst({
      where: {
        slackMemberId: dto.assigneeId,
        companyCode: publisher.companyCode,
        role: 'employee',
      },
      select: { id: true },
    });
    if (!assignee) {
      throw new BadRequestException(
        '같은 회사의 사원(Slack 멤버 ID)을 찾을 수 없습니다. 목록에서 선택해 주세요.',
      );
    }

    const saved = await this.prisma.quest.create({
      data: {
        id: generateQuestId(),
        title: dto.title,
        description: dto.description,
        deadline: dto.deadline,
        status: QuestStatus.PENDING,
        assigneeId: dto.assigneeId,
        feedback: null,
        proofData: null,
        proofMimeType: null,
        proofFileName: null,
        submissionNote: null,
        reviewerId: null,
        publisherSlackMemberId: publisher.slackMemberId,
        companyCode: publisher.companyCode,
      },
      select: questListSelect,
    });

    this.n8n.triggerWebhook('quest.created', {
      id: saved.id,
      title: saved.title,
      deadline: saved.deadline.toISOString(),
      assigneeId: saved.assigneeId,
      publisherSlackMemberId: saved.publisherSlackMemberId,
    });

    return this.toSummary(saved);
  }

  /**
   * 관리자 전용: 동일 회사코드에 등록된 사원 목록(퀘스트 담당 배정용).
   */
  async listAssignableEmployees(user: QuestJwtUser): Promise<AssignableEmployee[]> {
    if (user.role !== 'admin') {
      throw new ForbiddenException('관리자만 조회할 수 있습니다.');
    }

    const rows = await this.prisma.user.findMany({
      where: {
        companyCode: user.companyCode,
        role: 'employee',
      },
      select: {
        id: true,
        name: true,
        email: true,
        slackMemberId: true,
      },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
    });

    return rows;
  }

  async findAll(user: QuestJwtUser): Promise<QuestSummary[]> {
    const where =
      user.role === 'admin'
        ? { companyCode: user.companyCode }
        : { companyCode: user.companyCode, assigneeId: user.slackMemberId };

    const rows = await this.prisma.quest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: questListSelect,
    });
    return rows.map((r) => this.toSummary(r));
  }

  async findOne(id: string, user: QuestJwtUser): Promise<QuestSummary> {
    const q = await this.prisma.quest.findUnique({
      where: { id },
      select: questListSelect,
    });
    if (!q) throw new NotFoundException(`Quest(${id}) not found`);
    this.assertQuestAccess(
      { companyCode: q.companyCode, assigneeId: q.assigneeId },
      user,
    );
    return this.toSummary(q);
  }

  async getStats(user: QuestJwtUser): Promise<QuestProgressStats> {
    const baseWhere =
      user.role === 'admin'
        ? { companyCode: user.companyCode }
        : { companyCode: user.companyCode, assigneeId: user.slackMemberId };

    const [total, completed, inProgress, pending, rejected] = await Promise.all([
      this.prisma.quest.count({ where: baseWhere }),
      this.prisma.quest.count({
        where: { ...baseWhere, status: QuestStatus.COMPLETED },
      }),
      this.prisma.quest.count({
        where: { ...baseWhere, status: QuestStatus.IN_PROGRESS },
      }),
      this.prisma.quest.count({
        where: { ...baseWhere, status: QuestStatus.PENDING },
      }),
      this.prisma.quest.count({
        where: { ...baseWhere, status: QuestStatus.REJECTED },
      }),
    ]);
    const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, inProgress, pending, rejected, completionRate };
  }

  /**
   * 관리자 전용: 같은 회사에서 퀘스트가 배정된 담당자별 통계.
   * 퀘스트 이력이 없는 사원은 목록에 포함하지 않음.
   */
  async getStatsByAssignee(user: QuestJwtUser): Promise<AssigneeQuestStats[]> {
    if (user.role !== 'admin') {
      throw new ForbiddenException('관리자만 조회할 수 있습니다.');
    }

    const grouped = await this.prisma.quest.groupBy({
      by: ['assigneeId', 'status'],
      where: { companyCode: user.companyCode },
      _count: { id: true },
    });

    type Acc = {
      total: number;
      completed: number;
      inProgress: number;
      pending: number;
      rejected: number;
    };

    const map = new Map<string, Acc>();

    for (const row of grouped) {
      const cur = map.get(row.assigneeId) ?? {
        total: 0,
        completed: 0,
        inProgress: 0,
        pending: 0,
        rejected: 0,
      };
      const n = row._count.id;
      cur.total += n;
      if (row.status === QuestStatus.COMPLETED) cur.completed += n;
      else if (row.status === QuestStatus.IN_PROGRESS) cur.inProgress += n;
      else if (row.status === QuestStatus.PENDING) cur.pending += n;
      else if (row.status === QuestStatus.REJECTED) cur.rejected += n;
      map.set(row.assigneeId, cur);
    }

    const slackIds = [...map.keys()];
    if (slackIds.length === 0) return [];

    const users = await this.prisma.user.findMany({
      where: {
        companyCode: user.companyCode,
        slackMemberId: { in: slackIds },
      },
      select: { slackMemberId: true, name: true },
    });
    const nameBySlack = new Map(users.map((u) => [u.slackMemberId, u.name]));

    return [...map.entries()]
      .map(([assigneeId, s]) => ({
        assigneeId,
        assigneeName: nameBySlack.get(assigneeId) ?? null,
        total: s.total,
        completed: s.completed,
        inProgress: s.inProgress,
        pending: s.pending,
        rejected: s.rejected,
        completionRate:
          s.total === 0 ? 0 : Math.round((s.completed / s.total) * 100),
      }))
      .sort((a, b) => b.total - a.total);
  }

  async uploadProof(
    id: string,
    file: { buffer: Buffer; mimetype: string; originalname: string },
    user: QuestJwtUser,
    submissionNoteRaw?: unknown,
  ): Promise<QuestSummary> {
    const quest = await this.prisma.quest.findUnique({
      where: { id },
      select: questListSelect,
    });
    if (!quest) throw new NotFoundException(`Quest(${id}) not found`);

    if (quest.companyCode !== user.companyCode) {
      throw new ForbiddenException('이 퀘스트에 접근할 수 없습니다.');
    }
    if (quest.assigneeId !== user.slackMemberId) {
      throw new ForbiddenException('담당자만 증빙을 제출할 수 있습니다.');
    }

    if (quest.status === QuestStatus.COMPLETED) {
      throw new BadRequestException('이미 완료된 퀘스트입니다.');
    }

    const submissionNote = this.parseSubmissionNote(submissionNoteRaw);

    const saved = await this.prisma.quest.update({
      where: { id },
      data: {
        proofData: file.buffer,
        proofMimeType: file.mimetype,
        proofFileName: file.originalname,
        submissionNote,
        status: QuestStatus.IN_PROGRESS,
      },
      select: questListSelect,
    });

    this.n8n.triggerWebhook('quest.proof_uploaded', {
      id: saved.id,
      title: saved.title,
      fileName: saved.proofFileName,
      assigneeId: saved.assigneeId,
      publisherSlackMemberId: saved.publisherSlackMemberId,
      submissionNote: saved.submissionNote,
    });

    return this.toSummary(saved);
  }

  async reviewQuest(
    id: string,
    dto: ReviewQuestDto,
    user: QuestJwtUser,
  ): Promise<QuestSummary> {
    if (user.role !== 'admin') {
      throw new ForbiddenException('검토는 관리자만 가능합니다.');
    }

    if (
      dto.status !== QuestStatus.COMPLETED &&
      dto.status !== QuestStatus.REJECTED
    ) {
      throw new BadRequestException('검토 결과는 완료(2) 또는 반려(3)만 가능합니다.');
    }

    const quest = await this.prisma.quest.findUnique({
      where: { id },
      select: questListSelect,
    });
    if (!quest) throw new NotFoundException(`Quest(${id}) not found`);
    if (quest.companyCode !== user.companyCode) {
      throw new ForbiddenException('이 퀘스트를 검토할 수 없습니다.');
    }

    const saved = await this.prisma.quest.update({
      where: { id },
      data: {
        status: dto.status,
        feedback: dto.feedback ?? null,
        ...(dto.reviewerId ? { reviewerId: dto.reviewerId } : {}),
      },
      select: questListSelect,
    });

    this.n8n.triggerWebhook('quest.reviewed', {
      id: saved.id,
      title: saved.title,
      status: saved.status,
      feedback: saved.feedback,
      reviewerId: saved.reviewerId,
      assigneeId: saved.assigneeId,
      publisherSlackMemberId: saved.publisherSlackMemberId,
    });

    return this.toSummary(saved);
  }

  async getProof(
    id: string,
    user: QuestJwtUser,
  ): Promise<{ buffer: Buffer; mimeType: string; fileName: string } | null> {
    const quest = await this.prisma.quest.findUnique({
      where: { id },
      select: {
        companyCode: true,
        assigneeId: true,
        proofData: true,
        proofMimeType: true,
        proofFileName: true,
      },
    });

    if (!quest) throw new NotFoundException(`Quest(${id}) not found`);
    this.assertQuestAccess(
      { companyCode: quest.companyCode, assigneeId: quest.assigneeId },
      user,
    );

    if (!quest.proofData) return null;

    const buffer = Buffer.isBuffer(quest.proofData)
      ? quest.proofData
      : Buffer.from(quest.proofData);

    return {
      buffer,
      mimeType: quest.proofMimeType ?? 'application/octet-stream',
      fileName: quest.proofFileName ?? `proof-${id}.bin`,
    };
  }

  private parseSubmissionNote(raw: unknown): string | null {
    if (raw === undefined || raw === null) return null;
    const s = typeof raw === 'string' ? raw : String(raw);
    const t = s.trim();
    if (!t) return null;
    if (t.length > 5000) {
      throw new BadRequestException('추가 설명은 5,000자 이내입니다.');
    }
    return t;
  }

  private assertQuestAccess(
    q: { companyCode: string; assigneeId: string },
    user: QuestJwtUser,
  ): void {
    if (q.companyCode !== user.companyCode) {
      throw new ForbiddenException('이 퀘스트에 접근할 수 없습니다.');
    }
    if (user.role === 'admin') return;
    if (q.assigneeId !== user.slackMemberId) {
      throw new ForbiddenException('이 퀘스트에 접근할 수 없습니다.');
    }
  }

  private toSummary(q: QuestListRow): QuestSummary {
    return {
      id: q.id,
      title: q.title,
      description: q.description,
      deadline: q.deadline,
      status: q.status as QuestStatus,
      feedback: q.feedback,
      proofFileName: q.proofFileName,
      proofMimeType: q.proofMimeType,
      hasProof: !!q.proofFileName,
      submissionNote: q.submissionNote,
      assigneeId: q.assigneeId,
      reviewerId: q.reviewerId,
      publisherSlackMemberId: q.publisherSlackMemberId,
      companyCode: q.companyCode,
      createdAt: q.createdAt,
      updatedAt: q.updatedAt,
    };
  }
}
