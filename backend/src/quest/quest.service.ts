import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { formatDateTimeToMinute } from '../common/utils/format-datetime';
import { buildProofFileName } from '../common/utils/proof-filename';
import { generateQuestId } from '../common/utils/id-generator';
import {
  createProofShareToken,
  verifyProofShareToken,
} from '../common/utils/proof-share-token';
import { N8nService } from '../automation/n8n.service';
import { CreateQuestDto } from './dto/create-quest.dto';
import { DeclineQuestDto } from './dto/decline-quest.dto';
import { ReopenQuestDto } from './dto/reopen-quest.dto';
import { QuestListQueryDto } from './dto/quest-list-query.dto';
import { ReviewQuestDto } from './dto/review-quest.dto';
import { UpdateQuestDto } from './dto/update-quest.dto';
import { QuestStatus } from './enums/quest-status.enum';
import type { QuestJwtUser } from './quest-auth.types';
import { ROLES, isManagerRole as isManager } from '../common/roles';
import { AuditService } from '../audit/audit.service';

const questListSelect = {
  id: true,
  title: true,
  description: true,
  deadline: true,
  status: true,
  feedback: true,
  declineReason: true,
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
  declineReason: string | null;
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
  declineReason: string | null;
  proofFileName: string | null;
  proofMimeType: string | null;
  hasProof: boolean;
  submissionNote: string | null;
  assigneeId: string;
  assigneeName: string | null;
  reviewerId: string | null;
  publisherSlackMemberId: string;
  companyCode: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedQuests {
  items: QuestSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface QuestProgressStats {
  total: number;
  pending: number;
  started: number;
  submitted: number;
  completed: number;
  rejected: number;
  declined: number;
  completionRate: number;
}

/** 관리자용: 퀘스트가 1건 이상 배정된 담당자(Slack ID)별 집계 */
export interface AssigneeQuestStats {
  assigneeId: string;
  assigneeName: string | null;
  total: number;
  pending: number;
  started: number;
  submitted: number;
  completed: number;
  rejected: number;
  declined: number;
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
  private readonly logger = new Logger(QuestService.name);
  private readonly apiPublicUrl: string;
  private readonly proofShareSecret: string;
  private readonly proofShareTtlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly n8n: N8nService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {
    const base = (this.config.get<string>('API_PUBLIC_URL') ?? '').replace(
      /\/$/,
      '',
    );
    this.apiPublicUrl = base || 'http://localhost:3000/api';
    this.proofShareSecret =
      this.config.get<string>('PROOF_SHARE_SECRET') ??
      this.config.get<string>('N8N_WEBHOOK_SECRET') ??
      '';
    this.proofShareTtlSeconds = Number(
      this.config.get<string>('PROOF_SHARE_TTL_SECONDS') ?? 7 * 24 * 3600,
    );

    if (!this.config.get<string>('API_PUBLIC_URL')) {
      this.logger.warn(
        'API_PUBLIC_URL 미설정 — Slack 증빙 링크는 http://localhost:3000/api 기준으로 생성됩니다.',
      );
    }
    if (!this.proofShareSecret) {
      this.logger.warn(
        'PROOF_SHARE_SECRET / N8N_WEBHOOK_SECRET 미설정 — Slack 증빙 공유 링크가 생성되지 않습니다.',
      );
    }
  }

  async createQuest(dto: CreateQuestDto, publisher: QuestJwtUser): Promise<QuestSummary> {
    if (!isManager(publisher.role)) {
      throw new ForbiddenException('퀘스트 발행은 관리자만 가능합니다.');
    }

    const assignee = await this.prisma.user.findFirst({
      where: {
        slackMemberId: dto.assigneeId,
        companyCode: publisher.companyCode,
        role: ROLES.EMPLOYEE,
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

    const names = await this.resolveNamesBySlackIds(saved.companyCode, [
      saved.assigneeId,
      saved.publisherSlackMemberId,
    ]);

    this.n8n.triggerWebhook('quest.created', {
      id: saved.id,
      title: saved.title,
      deadline: saved.deadline.toISOString(),
      deadlineDisplay: formatDateTimeToMinute(saved.deadline),
      assigneeId: saved.assigneeId,
      assigneeName: names.get(saved.assigneeId) ?? null,
      publisherSlackMemberId: saved.publisherSlackMemberId,
      publisherName:
        names.get(saved.publisherSlackMemberId) ?? publisher.name ?? '관리자',
    });

    const [enriched] = await this.enrichSummaries([this.toSummary(saved)]);
    return enriched;
  }

  /**
   * 관리자 전용: 동일 회사코드에 등록된 사원 목록(퀘스트 담당 배정용).
   */
  async listAssignableEmployees(user: QuestJwtUser): Promise<AssignableEmployee[]> {
    if (!isManager(user.role)) {
      throw new ForbiddenException('관리자만 조회할 수 있습니다.');
    }

    const rows = await this.prisma.user.findMany({
      where: {
        companyCode: user.companyCode,
        role: ROLES.EMPLOYEE,
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

  async findAll(
    user: QuestJwtUser,
    query: QuestListQueryDto,
  ): Promise<PaginatedQuests> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    if (query.assigneeId && !isManager(user.role)) {
      throw new ForbiddenException('담당자별 조회는 관리자만 가능합니다.');
    }

    const where = {
      ...(isManager(user.role)
        ? { companyCode: user.companyCode }
        : { companyCode: user.companyCode, assigneeId: user.slackMemberId }),
      ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
      ...(query.status !== undefined ? { status: query.status } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.quest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: questListSelect,
      }),
      this.prisma.quest.count({ where }),
    ]);

    const summaries = await this.enrichSummaries(rows.map((r) => this.toSummary(r)));
    return {
      items: summaries,
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
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
    const summary = this.toSummary(q);
    const [enriched] = await this.enrichSummaries([summary]);
    return enriched;
  }

  async updateQuest(
    id: string,
    dto: UpdateQuestDto,
    user: QuestJwtUser,
  ): Promise<QuestSummary> {
    if (!isManager(user.role)) {
      throw new ForbiddenException('퀘스트 수정은 관리자만 가능합니다.');
    }

    const quest = await this.prisma.quest.findUnique({
      where: { id },
      select: questListSelect,
    });
    if (!quest) throw new NotFoundException(`Quest(${id}) not found`);
    if (quest.companyCode !== user.companyCode) {
      throw new ForbiddenException('이 퀘스트를 수정할 수 없습니다.');
    }
    if (quest.status !== QuestStatus.PENDING) {
      throw new BadRequestException('대기 상태의 퀘스트만 수정할 수 있습니다.');
    }

    if (!dto.title && !dto.description && !dto.deadline) {
      throw new BadRequestException('수정할 항목을 하나 이상 입력하세요.');
    }

    const saved = await this.prisma.quest.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.deadline !== undefined ? { deadline: dto.deadline } : {}),
      },
      select: questListSelect,
    });

    const [enriched] = await this.enrichSummaries([this.toSummary(saved)]);
    return enriched;
  }

  async deleteQuest(id: string, user: QuestJwtUser): Promise<void> {
    if (!isManager(user.role)) {
      throw new ForbiddenException('퀘스트 삭제는 관리자만 가능합니다.');
    }

    const quest = await this.prisma.quest.findUnique({
      where: { id },
      select: { companyCode: true, status: true, title: true },
    });
    if (!quest) throw new NotFoundException(`Quest(${id}) not found`);
    if (quest.companyCode !== user.companyCode) {
      throw new ForbiddenException('이 퀘스트를 삭제할 수 없습니다.');
    }
    if (
      quest.status !== QuestStatus.PENDING &&
      quest.status !== QuestStatus.DECLINED
    ) {
      throw new BadRequestException(
        '대기 또는 거부됨 상태의 퀘스트만 삭제할 수 있습니다.',
      );
    }

    await this.prisma.quest.delete({ where: { id } });

    await this.audit.record(user, {
      action: 'quest.deleted',
      targetType: 'quest',
      targetId: id,
      detail: `"${quest.title}" 삭제`,
    });
  }

  /**
   * 사원이 배정된 퀘스트의 수행 자체를 거부한다.
   * - 담당자 본인만 가능
   * - 대기·착수 상태에서만 가능 (이미 제출했거나 완료된 건은 거부 불가)
   * - 사유 필수 → status DECLINED 로 전환
   */
  async declineQuest(
    id: string,
    dto: DeclineQuestDto,
    user: QuestJwtUser,
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
      throw new ForbiddenException('담당자만 퀘스트를 거부할 수 있습니다.');
    }
    if (
      quest.status !== QuestStatus.PENDING &&
      quest.status !== QuestStatus.IN_PROGRESS
    ) {
      throw new BadRequestException(
        '대기 또는 착수 상태에서만 퀘스트를 거부할 수 있습니다.',
      );
    }

    const reason = dto.reason.trim();

    const saved = await this.prisma.quest.update({
      where: { id },
      data: {
        status: QuestStatus.DECLINED,
        declineReason: reason,
      },
      select: questListSelect,
    });

    const names = await this.resolveNamesBySlackIds(saved.companyCode, [
      saved.assigneeId,
      saved.publisherSlackMemberId,
    ]);

    this.n8n.triggerWebhook('quest.declined', {
      id: saved.id,
      title: saved.title,
      declineReason: saved.declineReason,
      assigneeId: saved.assigneeId,
      assigneeName: names.get(saved.assigneeId) ?? user.name ?? null,
      publisherSlackMemberId: saved.publisherSlackMemberId,
      publisherName: names.get(saved.publisherSlackMemberId) ?? null,
    });

    await this.audit.record(user, {
      action: 'quest.declined',
      targetType: 'quest',
      targetId: saved.id,
      detail: `"${saved.title}" 거부 — 사유: ${reason}`,
    });

    const [enriched] = await this.enrichSummaries([this.toSummary(saved)]);
    return enriched;
  }

  /**
   * 관리자/슈퍼관리자: 거부된 퀘스트를 다시 대기 상태로 되살린다(재개봉).
   * - dto.assigneeId 가 있으면 같은 회사의 사원으로 담당자를 재배정한다.
   * - 거부 사유를 비우고, 마감 알림 플래그도 초기화해 알림이 다시 동작하도록 한다.
   */
  async reopenQuest(
    id: string,
    dto: ReopenQuestDto,
    user: QuestJwtUser,
  ): Promise<QuestSummary> {
    if (!isManager(user.role)) {
      throw new ForbiddenException('퀘스트 재개봉은 관리자만 가능합니다.');
    }

    const quest = await this.prisma.quest.findUnique({
      where: { id },
      select: questListSelect,
    });
    if (!quest) throw new NotFoundException(`Quest(${id}) not found`);
    if (quest.companyCode !== user.companyCode) {
      throw new ForbiddenException('이 퀘스트를 재개봉할 수 없습니다.');
    }
    if (quest.status !== QuestStatus.DECLINED) {
      throw new BadRequestException('거부됨 상태의 퀘스트만 재개봉할 수 있습니다.');
    }

    let nextAssigneeId = quest.assigneeId;
    if (dto.assigneeId && dto.assigneeId !== quest.assigneeId) {
      const assignee = await this.prisma.user.findFirst({
        where: {
          slackMemberId: dto.assigneeId,
          companyCode: user.companyCode,
          role: ROLES.EMPLOYEE,
        },
        select: { id: true },
      });
      if (!assignee) {
        throw new BadRequestException(
          '같은 회사의 사원(Slack 멤버 ID)을 찾을 수 없습니다. 목록에서 선택해 주세요.',
        );
      }
      nextAssigneeId = dto.assigneeId;
    }

    const saved = await this.prisma.quest.update({
      where: { id },
      data: {
        status: QuestStatus.PENDING,
        declineReason: null,
        assigneeId: nextAssigneeId,
        deadlineSoonNotifiedAt: null,
        overdueNotifiedAt: null,
      },
      select: questListSelect,
    });

    const reassigned = nextAssigneeId !== quest.assigneeId;
    const names = await this.resolveNamesBySlackIds(saved.companyCode, [
      saved.assigneeId,
      saved.publisherSlackMemberId,
    ]);

    this.n8n.triggerWebhook('quest.reopened', {
      id: saved.id,
      title: saved.title,
      deadline: saved.deadline.toISOString(),
      deadlineDisplay: formatDateTimeToMinute(saved.deadline),
      assigneeId: saved.assigneeId,
      assigneeName: names.get(saved.assigneeId) ?? null,
      publisherSlackMemberId: saved.publisherSlackMemberId,
      publisherName: names.get(saved.publisherSlackMemberId) ?? user.name ?? null,
      reassigned,
    });

    await this.audit.record(user, {
      action: 'quest.reopened',
      targetType: 'quest',
      targetId: saved.id,
      detail: reassigned
        ? `"${saved.title}" 재개봉 — 담당자 재배정: ${saved.assigneeId}`
        : `"${saved.title}" 재개봉`,
    });

    const [enriched] = await this.enrichSummaries([this.toSummary(saved)]);
    return enriched;
  }

  async startQuest(id: string, user: QuestJwtUser): Promise<QuestSummary> {
    const quest = await this.prisma.quest.findUnique({
      where: { id },
      select: questListSelect,
    });
    if (!quest) throw new NotFoundException(`Quest(${id}) not found`);
    if (quest.companyCode !== user.companyCode) {
      throw new ForbiddenException('이 퀘스트에 접근할 수 없습니다.');
    }
    if (quest.assigneeId !== user.slackMemberId) {
      throw new ForbiddenException('담당자만 착수할 수 있습니다.');
    }
    if (quest.status !== QuestStatus.PENDING && quest.status !== QuestStatus.REJECTED) {
      throw new BadRequestException('대기 또는 반려 상태에서만 착수할 수 있습니다.');
    }

    const saved = await this.prisma.quest.update({
      where: { id },
      data: { status: QuestStatus.IN_PROGRESS },
      select: questListSelect,
    });

    const [enriched] = await this.enrichSummaries([this.toSummary(saved)]);
    return enriched;
  }

  async getStats(user: QuestJwtUser): Promise<QuestProgressStats> {
    const baseWhere = isManager(user.role)
      ? { companyCode: user.companyCode }
      : { companyCode: user.companyCode, assigneeId: user.slackMemberId };

    const [total, pending, started, submitted, completed, rejected, declined] =
      await Promise.all([
        this.prisma.quest.count({ where: baseWhere }),
        this.prisma.quest.count({
          where: { ...baseWhere, status: QuestStatus.PENDING },
        }),
        this.prisma.quest.count({
          where: { ...baseWhere, status: QuestStatus.IN_PROGRESS },
        }),
        this.prisma.quest.count({
          where: { ...baseWhere, status: QuestStatus.SUBMITTED },
        }),
        this.prisma.quest.count({
          where: { ...baseWhere, status: QuestStatus.COMPLETED },
        }),
        this.prisma.quest.count({
          where: { ...baseWhere, status: QuestStatus.REJECTED },
        }),
        this.prisma.quest.count({
          where: { ...baseWhere, status: QuestStatus.DECLINED },
        }),
      ]);
    // 완료율은 사원이 거부한 건을 분모에서 제외해 실제 수행 대상 기준으로 산정한다.
    const denom = total - declined;
    const completionRate = denom <= 0 ? 0 : Math.round((completed / denom) * 100);
    return {
      total,
      pending,
      started,
      submitted,
      completed,
      rejected,
      declined,
      completionRate,
    };
  }

  /**
   * 관리자 전용: 같은 회사에서 퀘스트가 배정된 담당자별 통계.
   * 퀘스트 이력이 없는 사원은 목록에 포함하지 않음.
   */
  async getStatsByAssignee(user: QuestJwtUser): Promise<AssigneeQuestStats[]> {
    if (!isManager(user.role)) {
      throw new ForbiddenException('관리자만 조회할 수 있습니다.');
    }

    const grouped = await this.prisma.quest.groupBy({
      by: ['assigneeId', 'status'],
      where: { companyCode: user.companyCode },
      _count: { id: true },
    });

    type Acc = {
      total: number;
      pending: number;
      started: number;
      submitted: number;
      completed: number;
      rejected: number;
      declined: number;
    };

    const map = new Map<string, Acc>();

    for (const row of grouped) {
      const cur = map.get(row.assigneeId) ?? {
        total: 0,
        pending: 0,
        started: 0,
        submitted: 0,
        completed: 0,
        rejected: 0,
        declined: 0,
      };
      const n = row._count.id;
      cur.total += n;
      if (row.status === QuestStatus.PENDING) cur.pending += n;
      else if (row.status === QuestStatus.IN_PROGRESS) cur.started += n;
      else if (row.status === QuestStatus.SUBMITTED) cur.submitted += n;
      else if (row.status === QuestStatus.COMPLETED) cur.completed += n;
      else if (row.status === QuestStatus.REJECTED) cur.rejected += n;
      else if (row.status === QuestStatus.DECLINED) cur.declined += n;
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
        pending: s.pending,
        started: s.started,
        submitted: s.submitted,
        completed: s.completed,
        rejected: s.rejected,
        declined: s.declined,
        completionRate:
          s.total - s.declined <= 0
            ? 0
            : Math.round((s.completed / (s.total - s.declined)) * 100),
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
    if (
      quest.status !== QuestStatus.IN_PROGRESS &&
      quest.status !== QuestStatus.SUBMITTED &&
      quest.status !== QuestStatus.REJECTED
    ) {
      throw new BadRequestException('착수한 뒤에만 증빙을 제출할 수 있습니다.');
    }

    const submissionNote = this.parseSubmissionNote(submissionNoteRaw);

    const proofFileName = buildProofFileName(
      user.name ?? '사원',
      quest.title,
      file.originalname,
    );

    const saved = await this.prisma.quest.update({
      where: { id },
      data: {
        proofData: file.buffer,
        proofMimeType: file.mimetype,
        proofFileName,
        submissionNote,
        status: QuestStatus.SUBMITTED,
        // 재제출 시 이전 검토 흔적(반려 피드백·검토자)을 초기화한다.
        feedback: null,
        reviewerId: null,
      },
      select: questListSelect,
    });

    const proofUrl = this.buildProofShareUrl(saved.id);
    const names = await this.resolveNamesBySlackIds(saved.companyCode, [
      saved.assigneeId,
      saved.publisherSlackMemberId,
    ]);

    this.n8n.triggerWebhook('quest.proof_uploaded', {
      id: saved.id,
      title: saved.title,
      fileName: saved.proofFileName,
      proofMimeType: saved.proofMimeType,
      proofUrl,
      assigneeId: saved.assigneeId,
      assigneeName: names.get(saved.assigneeId) ?? user.name ?? null,
      publisherSlackMemberId: saved.publisherSlackMemberId,
      publisherName: names.get(saved.publisherSlackMemberId) ?? null,
      submissionNote: saved.submissionNote,
    });

    const [enriched] = await this.enrichSummaries([this.toSummary(saved)]);
    return enriched;
  }

  async reviewQuest(
    id: string,
    dto: ReviewQuestDto,
    user: QuestJwtUser,
  ): Promise<QuestSummary> {
    if (!isManager(user.role)) {
      throw new ForbiddenException('검토는 관리자만 가능합니다.');
    }

    if (
      dto.status !== QuestStatus.COMPLETED &&
      dto.status !== QuestStatus.REJECTED
    ) {
      throw new BadRequestException('검토 결과는 완료(3) 또는 반려(4)만 가능합니다.');
    }

    if (dto.status === QuestStatus.REJECTED && !dto.feedback?.trim()) {
      throw new BadRequestException('반려 시 피드백은 필수입니다.');
    }

    const quest = await this.prisma.quest.findUnique({
      where: { id },
      select: questListSelect,
    });
    if (!quest) throw new NotFoundException(`Quest(${id}) not found`);
    if (quest.companyCode !== user.companyCode) {
      throw new ForbiddenException('이 퀘스트를 검토할 수 없습니다.');
    }
    if (quest.status !== QuestStatus.SUBMITTED) {
      throw new BadRequestException('검토 대기 상태의 퀘스트만 검토할 수 있습니다.');
    }

    const saved = await this.prisma.quest.update({
      where: { id },
      data: {
        status: dto.status,
        feedback: dto.feedback ?? null,
        reviewerId: dto.reviewerId ?? user.slackMemberId,
      },
      select: questListSelect,
    });

    const names = await this.resolveNamesBySlackIds(saved.companyCode, [
      saved.reviewerId,
      saved.assigneeId,
      saved.publisherSlackMemberId,
    ]);
    const reviewerSlack = saved.reviewerId ?? user.slackMemberId;

    this.n8n.triggerWebhook('quest.reviewed', {
      id: saved.id,
      title: saved.title,
      status: saved.status,
      feedback: saved.feedback,
      reviewerId: saved.reviewerId,
      reviewerName:
        names.get(reviewerSlack) ?? user.name ?? '관리자',
      assigneeId: saved.assigneeId,
      assigneeName: names.get(saved.assigneeId) ?? null,
      publisherSlackMemberId: saved.publisherSlackMemberId,
      publisherName: names.get(saved.publisherSlackMemberId) ?? null,
    });

    await this.audit.record(user, {
      action: dto.status === QuestStatus.COMPLETED ? 'quest.approved' : 'quest.rejected',
      targetType: 'quest',
      targetId: saved.id,
      detail:
        dto.status === QuestStatus.COMPLETED
          ? `"${saved.title}" 완료 승인`
          : `"${saved.title}" 반려 — 피드백: ${saved.feedback ?? ''}`,
    });

    const [enriched] = await this.enrichSummaries([this.toSummary(saved)]);
    return enriched;
  }

  buildProofShareUrl(questId: string): string | null {
    if (!this.proofShareSecret) return null;
    const token = createProofShareToken(
      questId,
      this.proofShareSecret,
      this.proofShareTtlSeconds,
    );
    return `${this.apiPublicUrl}/quests/${encodeURIComponent(questId)}/proof/share?token=${encodeURIComponent(token)}`;
  }

  async getProofViaShareToken(
    questId: string,
    token: string,
  ): Promise<{ buffer: Buffer; mimeType: string; fileName: string } | null> {
    if (!this.proofShareSecret) {
      throw new UnauthorizedException('증빙 공유가 설정되지 않았습니다.');
    }
    if (!verifyProofShareToken(token, questId, this.proofShareSecret)) {
      throw new UnauthorizedException('만료되었거나 유효하지 않은 공유 링크입니다.');
    }
    return this.loadProofBlob(questId);
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

    return this.loadProofBlob(id);
  }

  private async loadProofBlob(
    id: string,
  ): Promise<{ buffer: Buffer; mimeType: string; fileName: string } | null> {
    const quest = await this.prisma.quest.findUnique({
      where: { id },
      select: {
        proofData: true,
        proofMimeType: true,
        proofFileName: true,
      },
    });
    if (!quest?.proofData) return null;

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
    if (isManager(user.role)) return;
    if (q.assigneeId !== user.slackMemberId) {
      throw new ForbiddenException('이 퀘스트에 접근할 수 없습니다.');
    }
  }

  private async resolveNamesBySlackIds(
    companyCode: string,
    slackIds: (string | null | undefined)[],
  ): Promise<Map<string, string>> {
    const ids = [
      ...new Set(
        slackIds.filter((id): id is string => typeof id === 'string' && !!id.trim()),
      ),
    ];
    if (ids.length === 0) return new Map();

    const users = await this.prisma.user.findMany({
      where: { companyCode, slackMemberId: { in: ids } },
      select: { slackMemberId: true, name: true },
    });
    return new Map(users.map((u) => [u.slackMemberId, u.name]));
  }

  private async enrichSummaries(items: QuestSummary[]): Promise<QuestSummary[]> {
    if (items.length === 0) return items;

    const slackIds = [...new Set(items.map((q) => q.assigneeId))];
    const companyCode = items[0].companyCode;

    const users = await this.prisma.user.findMany({
      where: { companyCode, slackMemberId: { in: slackIds } },
      select: { slackMemberId: true, name: true },
    });
    const nameBySlack = new Map(users.map((u) => [u.slackMemberId, u.name]));

    return items.map((q) => ({
      ...q,
      assigneeName: nameBySlack.get(q.assigneeId) ?? null,
    }));
  }

  private toSummary(q: QuestListRow): QuestSummary {
    return {
      id: q.id,
      title: q.title,
      description: q.description,
      deadline: q.deadline,
      status: q.status as QuestStatus,
      feedback: q.feedback,
      declineReason: q.declineReason,
      proofFileName: q.proofFileName,
      proofMimeType: q.proofMimeType,
      hasProof: !!q.proofFileName,
      submissionNote: q.submissionNote,
      assigneeId: q.assigneeId,
      assigneeName: null,
      reviewerId: q.reviewerId,
      publisherSlackMemberId: q.publisherSlackMemberId,
      companyCode: q.companyCode,
      createdAt: q.createdAt,
      updatedAt: q.updatedAt,
    };
  }
}
