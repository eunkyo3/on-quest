import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AutomationModule } from './automation/automation.module';
import { PrismaModule } from './prisma/prisma.module';
import { QuestModule } from './quest/quest.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    QuestModule,
    AutomationModule,
  ],
})
export class AppModule {}
