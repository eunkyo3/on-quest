import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDate,
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinDate,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** CSV 한 행에 해당하는 일괄 발행 항목 */
export class BulkQuestItemDto {
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
  @MinDate(() => new Date(), { message: '마감 기한은 현재 시각 이후여야 합니다.' })
  deadline!: Date;

  /** 담당 사원 이메일 — 같은 회사코드의 employee 로 해석된다 */
  @IsEmail({}, { message: '유효한 담당자 이메일을 입력하세요.' })
  assigneeEmail!: string;
}

export class BulkCreateQuestsDto {
  @IsArray()
  @ArrayMinSize(1, { message: '발행할 항목이 없습니다.' })
  @ArrayMaxSize(100, { message: '한 번에 최대 100건까지 발행할 수 있습니다.' })
  @ValidateNested({ each: true })
  @Type(() => BulkQuestItemDto)
  items!: BulkQuestItemDto[];
}
