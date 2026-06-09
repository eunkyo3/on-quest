import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class SignUpDto {
  @IsEmail({}, { message: '유효한 이메일을 입력하세요.' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: '이름은 필수입니다.' })
  @MaxLength(80)
  name!: string;

  @IsString()
  @MinLength(8, { message: '비밀번호는 8자 이상이어야 합니다.' })
  @MaxLength(50)
  password!: string;

  @IsString()
  @IsNotEmpty({ message: 'Slack 멤버 ID는 필수입니다.' })
  @Matches(/^[A-Z0-9]{8,64}$/i, {
    message: 'Slack 멤버 ID 형식이 올바르지 않습니다.',
  })
  slackMemberId!: string;

  @IsString()
  @IsNotEmpty({ message: '회사코드는 필수입니다.' })
  @MaxLength(32)
  companyCode!: string;
}
