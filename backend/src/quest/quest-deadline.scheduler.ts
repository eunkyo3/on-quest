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
        companyCode: true,
      },
    });

    for (const q of soonCandidates) {
      // 원자적 클레임: 아직 알림이 안 나간 행만 선점한다.
      // 다중 인스턴스·중복 실행 시에도 한 번만 webhook 이 발사된다.
      const claimed = await this.prisma.quest.updateMany({
        where: { id: q.id, deadlineSoonNotifiedAt: null },
        data: { deadlineSoonNotifiedAt: now },
      });
      if (claimed.count === 0) continue;

      const names = await this.resolveNames(q.companyCode, [
        q.assigneeId,
        q.publisherSlackMemberId,
      ]);
      this.n8n.triggerWebhook('quest.deadline_soon', {
        id: q.id,
        title: q.title,
        deadlineDisplay: formatDateTimeToMinute(q.deadline),
        assigneeId: q.assigneeId,
        assigneeName: names.get(q.assigneeId) ?? null,
        publisherSlackMemberId: q.publisherSlackMemberId,
        publisherName: names.get(q.publisherSlackMemberId) ?? null,
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
        companyCode: true,
      },
    });

    for (const q of overdueCandidates) {
      const claimed = await this.prisma.quest.updateMany({
        where: { id: q.id, overdueNotifiedAt: null },
        data: { overdueNotifiedAt: now },
      });
      if (claimed.count === 0) continue;

      const names = await this.resolveNames(q.companyCode, [
        q.assigneeId,
        q.publisherSlackMemberId,
      ]);
      this.n8n.triggerWebhook('quest.deadline_overdue', {
        id: q.id,
        title: q.title,
        deadlineDisplay: formatDateTimeToMinute(q.deadline),
        assigneeId: q.assigneeId,
        assigneeName: names.get(q.assigneeId) ?? null,
        publisherSlackMemberId: q.publisherSlackMemberId,
        publisherName: names.get(q.publisherSlackMemberId) ?? null,
      });
    }

    if (soonCandidates.length > 0 || overdueCandidates.length > 0) {
      this.logger.log(
        `Deadline alerts: soon=${soonCandidates.length}, overdue=${overdueCandidates.length}`,
      );
    }
  }

  private async resolveNames(
    companyCode: string,
    slackIds: string[],
  ): Promise<Map<string, string>> {
    const ids = [...new Set(slackIds.filter(Boolean))];
    if (ids.length === 0) return new Map();
    const users = await this.prisma.user.findMany({
      where: { companyCode, slackMemberId: { in: ids } },
      select: { slackMemberId: true, name: true },
    });
    return new Map(users.map((u) => [u.slackMemberId, u.name]));
  }
}
