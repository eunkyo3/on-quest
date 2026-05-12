import { Type } from 'class-transformer';
import {
  IsDate,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinDate,
  MinLength,
} from 'class-validator';

/**
 * 퀘스트 생성 요청 DTO.
 * 요구사항명세서 §관리자 - "제목/설명/마감기한 유효성 검사 포함"
 */
export class CreateQuestDto {
  @IsString()
  @IsNotEmpty({ message: '제목은 필수입니다.' })
  @MinLength(2, { message: '제목은 최소 2자 이상이어야 합니다.' })
  @MaxLength(120, { message: '제목은 120자 이내여야 합니다.' })
  title!: string;

  @IsString()
  @IsNotEmpty({ message: '설명은 필수입니다.' })
  @MaxLength(5000, { message: '설명은 5,000자 이내여야 합니다.' })
  description!: string;

  @Type(() => Date)
  @IsDate({ message: '마감 기한은 유효한 날짜여야 합니다.' })
  @MinDate(new Date(), { message: '마감 기한은 현재 시각 이후여야 합니다.' })
  deadline!: Date;

  /** 담당 사원 Slack 멤버 ID (필수) */
  @IsString()
  @IsNotEmpty({ message: '담당 사원 Slack 멤버 ID는 필수입니다.' })
  @Matches(/^[A-Z0-9]{8,64}$/i, {
    message: 'Slack 멤버 ID 형식이 올바르지 않습니다.',
  })
  assigneeId!: string;
}
