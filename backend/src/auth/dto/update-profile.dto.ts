import { IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  slackMemberId?: string;

  // 가입(sign-up.dto)·로그인과 동일한 8자 하한으로 통일 — 변경 시 더 약한 비밀번호 방지
  @IsOptional()
  @IsString()
  @MinLength(8, { message: '비밀번호는 8자 이상이어야 합니다.' })
  @MaxLength(72)
  newPassword?: string;

  @ValidateIf((o: UpdateProfileDto) => !!o.newPassword)
  @IsString()
  @MinLength(1)
  currentPassword?: string;
}
