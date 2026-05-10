import { Module } from '@nestjs/common';
import { AutomationModule } from '../automation/automation.module';
import { QuestController } from './quest.controller';
import { QuestService } from './quest.service';

@Module({
  imports: [AutomationModule],
  controllers: [QuestController],
  providers: [QuestService],
  exports: [QuestService],
})
export class QuestModule {}
