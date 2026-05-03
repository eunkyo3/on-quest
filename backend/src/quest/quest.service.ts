import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { generateQuestId } from '../common/utils/id-generator';
import { N8nService } from '../automation/n8n.service';
import { CreateQuestDto } from './dto/create-quest.dto';
import { ReviewQuestDto } from './dto/review-quest.dto';
import { QuestEntity } from './entities/quest.entity';
import { QuestStatus } from './enums/quest-status.enum';

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
    @InjectRepository(QuestEntity)
    private readonly repo: Repository<QuestEntity>,
    private readonly n8n: N8nService,
  ) {}

  async createQuest(dto: CreateQuestDto): Promise<QuestSummary> {
    const quest = this.repo.create({
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
    });
    const saved = await this.repo.save(quest);

    // 신규 퀘스트 생성 → Slack 알림 (사수/신입 채널)
    this.n8n.triggerWebhook('quest.created', {
      id: saved.id,
      title: saved.title,
      deadline: saved.deadline.toISOString(),
      assigneeId: saved.assigneeId,
    });

    return this.toSummary(saved);
  }

  async findAll(): Promise<QuestSummary[]> {
    const rows = await this.repo.find({ order: { createdAt: 'DESC' } });
    return rows.map((r) => this.toSummary(r));
  }

  async findOne(id: string): Promise<QuestSummary> {
    const q = await this.repo.findOne({ where: { id } });
    if (!q) throw new NotFoundException(`Quest(${id}) not found`);
    return this.toSummary(q);
  }

  async getStats(): Promise<QuestProgressStats> {
    const [total, completed, inProgress, pending, rejected] = await Promise.all(
      [
        this.repo.count(),
        this.repo.count({ where: { status: QuestStatus.COMPLETED } }),
        this.repo.count({ where: { status: QuestStatus.IN_PROGRESS } }),
        this.repo.count({ where: { status: QuestStatus.PENDING } }),
        this.repo.count({ where: { status: QuestStatus.REJECTED } }),
      ],
    );
    const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, inProgress, pending, rejected, completionRate };
  }

  async uploadProof(
    id: string,
    file: { buffer: Buffer; mimetype: string; originalname: string },
  ): Promise<QuestSummary> {
    const quest = await this.repo.findOne({ where: { id } });
    if (!quest) throw new NotFoundException(`Quest(${id}) not found`);

    if (quest.status === QuestStatus.COMPLETED) {
      throw new BadRequestException('이미 완료된 퀘스트입니다.');
    }

    quest.proofData = file.buffer;
    quest.proofMimeType = file.mimetype;
    quest.proofFileName = file.originalname;
    // 증빙자료 제출 시 자동으로 진행중 → (사수 검토 대기) 상태로 올림
    quest.status = QuestStatus.IN_PROGRESS;

    const saved = await this.repo.save(quest);

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

    const quest = await this.repo.findOne({ where: { id } });
    if (!quest) throw new NotFoundException(`Quest(${id}) not found`);

    quest.status = dto.status;
    quest.feedback = dto.feedback ?? null;
    if (dto.reviewerId) quest.reviewerId = dto.reviewerId;

    const saved = await this.repo.save(quest);

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
    const quest = await this.repo
      .createQueryBuilder('q')
      .addSelect('q.proofData')
      .where('q.id = :id', { id })
      .getOne();

    if (!quest) throw new NotFoundException(`Quest(${id}) not found`);
    if (!quest.proofData) return null;

    return {
      buffer: quest.proofData,
      mimeType: quest.proofMimeType ?? 'application/octet-stream',
      fileName: quest.proofFileName ?? `proof-${id}.bin`,
    };
  }

  private toSummary(q: QuestEntity): QuestSummary {
    return {
      id: q.id,
      title: q.title,
      description: q.description,
      deadline: q.deadline,
      status: q.status,
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
