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

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  newPassword?: string;

  @ValidateIf((o: UpdateProfileDto) => !!o.newPassword)
  @IsString()
  @MinLength(1)
  currentPassword?: string;
}
