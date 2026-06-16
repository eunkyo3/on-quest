import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { QuestStatus } from '../enums/quest-status.enum';

/**
 * 관리자 검토 DTO.
 * status 는 완료(3) 또는 반려(4) 만 허용한다.
 */
export class ReviewQuestDto {
  @IsEnum(QuestStatus, { message: '유효하지 않은 상태 코드입니다.' })
  status!: QuestStatus.COMPLETED | QuestStatus.REJECTED;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  feedback?: string;

  // assigneeId 와 동일한 Slack 멤버 ID 형식·길이 제약 — 미적용 시 VarChar(64) 초과로 500 발생.
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9]{8,64}$/i, {
    message: '검토자 Slack 멤버 ID 형식이 올바르지 않습니다.',
  })
  reviewerId?: string;
}
