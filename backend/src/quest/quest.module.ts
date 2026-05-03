import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutomationModule } from '../automation/automation.module';
import { QuestEntity } from './entities/quest.entity';
import { QuestController } from './quest.controller';
import { QuestService } from './quest.service';

@Module({
  imports: [TypeOrmModule.forFeature([QuestEntity]), AutomationModule],
  controllers: [QuestController],
  providers: [QuestService],
  exports: [QuestService],
})
export class QuestModule {}
