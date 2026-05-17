import { Type } from 'class-transformer';
import {
  IsDate,
  IsOptional,
  IsString,
  MaxLength,
  MinDate,
  MinLength,
} from 'class-validator';

export class UpdateQuestDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: '제목은 최소 2자 이상이어야 합니다.' })
  @MaxLength(120, { message: '제목은 120자 이내여야 합니다.' })
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: '설명은 5,000자 이내여야 합니다.' })
  description?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: '마감 기한은 유효한 날짜여야 합니다.' })
  @MinDate(() => new Date(), { message: '마감 기한은 현재 시각 이후여야 합니다.' })
  deadline?: Date;
}
