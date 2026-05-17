import { Module } from '@nestjs/common';
import { AutomationModule } from '../automation/automation.module';
import { QuestController } from './quest.controller';
import { QuestProofShareController } from './quest-proof-share.controller';
import { QuestService } from './quest.service';

@Module({
  imports: [AutomationModule],
  controllers: [QuestController, QuestProofShareController],
  providers: [QuestService],
  exports: [QuestService],
})
export class QuestModule {}
