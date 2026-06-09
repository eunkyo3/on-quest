import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ROLES } from '../common/roles';
import type { QuestJwtUser } from '../quest/quest-auth.types';
import { UpdateRoleDto } from './dto/update-role.dto';

export interface ManagedUser {
  id: string;
  email: string;
  name: string;
  slackMemberId: string;
  role: string;
  createdAt: Date;
}

const userSelect = {
  id: true,
  email: true,
  name: true,
  slackMemberId: true,
  role: true,
  createdAt: true,
} as const;

/** 역할 정렬 우선순위: 슈퍼관리자 → 관리자 → 신입사원 */
const ROLE_ORDER: Record<string, number> = {
  [ROLES.SUPERADMIN]: 0,
  [ROLES.ADMIN]: 1,
  [ROLES.EMPLOYEE]: 2,
};

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** 슈퍼관리자 전용: 같은 회사의 전체 사용자 목록 */
  async listCompanyUsers(actor: QuestJwtUser): Promise<ManagedUser[]> {
    const rows = await this.prisma.user.findMany({
      where: { companyCode: actor.companyCode },
      select: userSelect,
    });

    return rows.sort((a, b) => {
      const ra = ROLE_ORDER[a.role] ?? 99;
      const rb = ROLE_ORDER[b.role] ?? 99;
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name, 'ko');
    });
  }

  /** 슈퍼관리자 전용: 신입사원 ↔ 관리자 역할 변경 */
  async updateRole(
    targetId: string,
    dto: UpdateRoleDto,
    actor: QuestJwtUser,
  ): Promise<ManagedUser> {
    if (targetId === actor.sub) {
      throw new BadRequestException('본인의 역할은 변경할 수 없습니다.');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, name: true, companyCode: true, role: true },
    });
    if (!target) {
      throw new NotFoundException('대상 사용자를 찾을 수 없습니다.');
    }
    if (target.companyCode !== actor.companyCode) {
      throw new ForbiddenException('다른 회사의 사용자는 변경할 수 없습니다.');
    }
    if (target.role === ROLES.SUPERADMIN) {
      throw new BadRequestException('슈퍼관리자의 역할은 변경할 수 없습니다.');
    }
    if (target.role === dto.role) {
      throw new BadRequestException('이미 해당 역할입니다.');
    }

    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: { role: dto.role },
      select: userSelect,
    });

    await this.audit.record(actor, {
      action: 'user.role_changed',
      targetType: 'user',
      targetId: updated.id,
      detail: `${updated.name}: ${target.role} → ${dto.role}`,
    });

    return updated;
  }

  /**
   * 슈퍼관리자 전용: 슈퍼관리자 권한을 다른 구성원에게 이양한다.
   * - 대상은 관리자/신입사원이어야 한다.
   * - 트랜잭션에서 "본인 → admin 강등" 후 "대상 → superadmin 승격" 순으로 처리해
   *   회사당 슈퍼관리자 1명 유니크 인덱스를 위반하지 않게 한다.
   */
  async transferOwnership(
    targetId: string,
    actor: QuestJwtUser,
  ): Promise<{ self: ManagedUser; target: ManagedUser }> {
    if (targetId === actor.sub) {
      throw new BadRequestException('본인에게는 이양할 수 없습니다.');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, name: true, companyCode: true, role: true },
    });
    if (!target) {
      throw new NotFoundException('대상 사용자를 찾을 수 없습니다.');
    }
    if (target.companyCode !== actor.companyCode) {
      throw new ForbiddenException('다른 회사의 사용자에게는 이양할 수 없습니다.');
    }
    if (target.role === ROLES.SUPERADMIN) {
      throw new BadRequestException('이미 슈퍼관리자입니다.');
    }

    const [self, promoted] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: actor.sub },
        data: { role: ROLES.ADMIN },
        select: userSelect,
      }),
      this.prisma.user.update({
        where: { id: targetId },
        data: { role: ROLES.SUPERADMIN },
        select: userSelect,
      }),
    ]);

    await this.audit.record(actor, {
      action: 'user.ownership_transferred',
      targetType: 'user',
      targetId: promoted.id,
      detail: `슈퍼관리자 이양: ${self.name}(→관리자) → ${promoted.name}(→슈퍼관리자)`,
    });

    return { self, target: promoted };
  }
}
