import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { QuestStatus } from '../enums/quest-status.enum';

export class QuestListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsEnum(QuestStatus, { message: '유효하지 않은 상태 코드입니다.' })
  status?: QuestStatus;

  /** 관리자 통계: 특정 담당자(Slack ID) 퀘스트만 조회 */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  assigneeId?: string;
}
