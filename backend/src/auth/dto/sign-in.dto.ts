import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class SignInDto {
  /** 로그인 아이디(가입 시 등록한 이메일) */
  @IsString()
  @IsNotEmpty({ message: '아이디를 입력하세요.' })
  @IsEmail({}, { message: '아이디는 유효한 이메일 형식이어야 합니다.' })
  loginId!: string;

  @IsString()
  @MinLength(8, { message: '비밀번호는 8자 이상이어야 합니다.' })
  @MaxLength(50)
  password!: string;
}
