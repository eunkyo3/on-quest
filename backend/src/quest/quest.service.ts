import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { generateQuestId } from '../common/utils/id-generator';
import { N8nService } from '../automation/n8n.service';
import { CreateQuestDto } from './dto/create-quest.dto';
import { ReviewQuestDto } from './dto/review-quest.dto';
import { QuestStatus } from './enums/quest-status.enum';

const questListSelect = {
  id: true,
  title: true,
  description: true,
  deadline: true,
  status: true,
  feedback: true,
  proofFileName: true,
  proofMimeType: true,
  assigneeId: true,
  reviewerId: true,
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
  assigneeId: string | null;
  reviewerId: string | null;
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
  assigneeId: string | null;
  reviewerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 진행률 통계 — 프론트 대시보드 프로그레스바에서 사용.
 */
export interface QuestProgressStats {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  rejected: number;
  completionRate: number;
}

@Injectable()
export class QuestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly n8n: N8nService,
  ) {}

  async createQuest(dto: CreateQuestDto): Promise<QuestSummary> {
    const saved = await this.prisma.quest.create({
      data: {
        id: generateQuestId(),
        title: dto.title,
        description: dto.description,
        deadline: dto.deadline,
        status: QuestStatus.PENDING,
        assigneeId: dto.assigneeId ?? null,
        feedback: null,
        proofData: null,
        proofMimeType: null,
        proofFileName: null,
        reviewerId: null,
      },
      select: questListSelect,
    });

    this.n8n.triggerWebhook('quest.created', {
      id: saved.id,
      title: saved.title,
      deadline: saved.deadline.toISOString(),
      assigneeId: saved.assigneeId,
    });

    return this.toSummary(saved);
  }

  async findAll(): Promise<QuestSummary[]> {
    const rows = await this.prisma.quest.findMany({
      orderBy: { createdAt: 'desc' },
      select: questListSelect,
    });
    return rows.map((r) => this.toSummary(r));
  }

  async findOne(id: string): Promise<QuestSummary> {
    const q = await this.prisma.quest.findUnique({
      where: { id },
      select: questListSelect,
    });
    if (!q) throw new NotFoundException(`Quest(${id}) not found`);
    return this.toSummary(q);
  }

  async getStats(): Promise<QuestProgressStats> {
    const [total, completed, inProgress, pending, rejected] = await Promise.all([
      this.prisma.quest.count(),
      this.prisma.quest.count({ where: { status: QuestStatus.COMPLETED } }),
      this.prisma.quest.count({ where: { status: QuestStatus.IN_PROGRESS } }),
      this.prisma.quest.count({ where: { status: QuestStatus.PENDING } }),
      this.prisma.quest.count({ where: { status: QuestStatus.REJECTED } }),
    ]);
    const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, inProgress, pending, rejected, completionRate };
  }

  async uploadProof(
    id: string,
    file: { buffer: Buffer; mimetype: string; originalname: string },
  ): Promise<QuestSummary> {
    const quest = await this.prisma.quest.findUnique({
      where: { id },
      select: questListSelect,
    });
    if (!quest) throw new NotFoundException(`Quest(${id}) not found`);

    if (quest.status === QuestStatus.COMPLETED) {
      throw new BadRequestException('이미 완료된 퀘스트입니다.');
    }

    const saved = await this.prisma.quest.update({
      where: { id },
      data: {
        proofData: file.buffer,
        proofMimeType: file.mimetype,
        proofFileName: file.originalname,
        status: QuestStatus.IN_PROGRESS,
      },
      select: questListSelect,
    });

    this.n8n.triggerWebhook('quest.proof_uploaded', {
      id: saved.id,
      title: saved.title,
      fileName: saved.proofFileName,
      reviewerId: saved.reviewerId,
    });

    return this.toSummary(saved);
  }

  async reviewQuest(id: string, dto: ReviewQuestDto): Promise<QuestSummary> {
    if (
      dto.status !== QuestStatus.COMPLETED &&
      dto.status !== QuestStatus.REJECTED
    ) {
      throw new BadRequestException('검토 결과는 완료(2) 또는 반려(3)만 가능합니다.');
    }

    const exists = await this.prisma.quest.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException(`Quest(${id}) not found`);

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
    });

    return this.toSummary(saved);
  }

  async getProof(
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

    if (!quest) throw new NotFoundException(`Quest(${id}) not found`);
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
      assigneeId: q.assigneeId,
      reviewerId: q.reviewerId,
      createdAt: q.createdAt,
      updatedAt: q.updatedAt,
    };
  }
}
