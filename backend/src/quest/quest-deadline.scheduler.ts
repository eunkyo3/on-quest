import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { formatDateTimeToMinute } from '../common/utils/format-datetime';
import { N8nService } from '../automation/n8n.service';
import { QuestStatus } from './enums/quest-status.enum';

const SOON_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class QuestDeadlineScheduler {
  private readonly logger = new Logger(QuestDeadlineScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly n8n: N8nService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleDeadlines(): Promise<void> {
    const now = new Date();
    const soonLimit = new Date(now.getTime() + SOON_MS);

    const openStatuses = [
      QuestStatus.PENDING,
      QuestStatus.IN_PROGRESS,
      QuestStatus.SUBMITTED,
      QuestStatus.REJECTED,
    ];

    const soonCandidates = await this.prisma.quest.findMany({
      where: {
        status: { in: openStatuses },
        deadlineSoonNotifiedAt: null,
        deadline: { gt: now, lte: soonLimit },
      },
      select: {
        id: true,
        title: true,
        deadline: true,
        assigneeId: true,
        publisherSlackMemberId: true,
      },
    });

    for (const q of soonCandidates) {
      this.n8n.triggerWebhook('quest.deadline_soon', {
        id: q.id,
        title: q.title,
        deadlineDisplay: formatDateTimeToMinute(q.deadline),
        assigneeId: q.assigneeId,
        publisherSlackMemberId: q.publisherSlackMemberId,
      });
      await this.prisma.quest.update({
        where: { id: q.id },
        data: { deadlineSoonNotifiedAt: now },
      });
    }

    const overdueCandidates = await this.prisma.quest.findMany({
      where: {
        status: { in: openStatuses },
        overdueNotifiedAt: null,
        deadline: { lt: now },
      },
      select: {
        id: true,
        title: true,
        deadline: true,
        assigneeId: true,
        publisherSlackMemberId: true,
      },
    });

    for (const q of overdueCandidates) {
      this.n8n.triggerWebhook('quest.deadline_overdue', {
        id: q.id,
        title: q.title,
        deadlineDisplay: formatDateTimeToMinute(q.deadline),
        assigneeId: q.assigneeId,
        publisherSlackMemberId: q.publisherSlackMemberId,
      });
      await this.prisma.quest.update({
        where: { id: q.id },
        data: { overdueNotifiedAt: now },
      });
    }

    if (soonCandidates.length > 0 || overdueCandidates.length > 0) {
      this.logger.log(
        `Deadline alerts: soon=${soonCandidates.length}, overdue=${overdueCandidates.length}`,
      );
    }
  }
}
