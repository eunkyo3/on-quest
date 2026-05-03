import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { QuestStatus } from '../enums/quest-status.enum';

/**
 * 관리자 검토 DTO.
 * status 는 완료(2) 또는 반려(3) 만 허용한다.
 */
export class ReviewQuestDto {
  @IsEnum(QuestStatus, { message: '유효하지 않은 상태 코드입니다.' })
  status!: QuestStatus.COMPLETED | QuestStatus.REJECTED;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  feedback?: string;

  @IsOptional()
  @IsString()
  reviewerId?: string;
}
