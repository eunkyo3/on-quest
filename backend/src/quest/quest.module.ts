import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AutomationModule } from '../automation/automation.module';
import { QuestController } from './quest.controller';
import { QuestDeadlineScheduler } from './quest-deadline.scheduler';
import { QuestProofShareController } from './quest-proof-share.controller';
import { QuestService } from './quest.service';

@Module({
  imports: [AutomationModule, ScheduleModule.forRoot()],
  controllers: [QuestController, QuestProofShareController],
  providers: [QuestService, QuestDeadlineScheduler],
  exports: [QuestService],
})
export class QuestModule {}
