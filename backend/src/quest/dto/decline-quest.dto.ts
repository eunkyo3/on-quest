import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class DeclineQuestDto {
  @IsString()
  @IsNotEmpty({ message: '거부 사유는 필수입니다.' })
  @MinLength(2, { message: '거부 사유는 최소 2자 이상이어야 합니다.' })
  @MaxLength(2000, { message: '거부 사유는 2,000자 이내여야 합니다.' })
  reason!: string;
}
