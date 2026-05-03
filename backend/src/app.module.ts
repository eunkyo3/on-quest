import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutomationModule } from './automation/automation.module';
import { QuestEntity } from './quest/entities/quest.entity';
import { QuestModule } from './quest/quest.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: Number(config.get<string>('DB_PORT', '5432')),
        username: config.get<string>('DB_USER', 'onquest'),
        password: config.get<string>('DB_PASSWORD', 'onquest_pw'),
        database: config.get<string>('DB_NAME', 'onquest'),
        entities: [QuestEntity],
        // MVP: 개발 생산성을 위해 synchronize=true
        // 운영 이관 시 migration 기반으로 전환 필요
        synchronize: true,
        logging: config.get<string>('NODE_ENV') !== 'production',
      }),
    }),
    QuestModule,
    AutomationModule,
  ],
})
export class AppModule {}
