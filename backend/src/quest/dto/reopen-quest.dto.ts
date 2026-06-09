import { IsOptional, IsString, Matches } from 'class-validator';

export class ReopenQuestDto {
  /** 선택: 재개봉하면서 다른 사원으로 담당자를 재배정할 때의 Slack 멤버 ID */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9]{8,64}$/i, {
    message: 'Slack 멤버 ID 형식이 올바르지 않습니다.',
  })
  assigneeId?: string;
}
