import { IsIn, IsString } from 'class-validator';

export class UpdateRoleDto {
  /** 슈퍼관리자가 부여할 수 있는 역할은 관리자/신입사원 두 가지뿐이다. */
  @IsString()
  @IsIn(['admin', 'employee'], {
    message: '역할은 admin 또는 employee만 가능합니다.',
  })
  role!: 'admin' | 'employee';
}
