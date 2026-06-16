import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { ROLES } from '../common/roles';
import { SignInDto } from './dto/sign-in.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  slackMemberId: string;
  companyCode: string;
  role: string;
}

interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
  companyCode: string;
  slackMemberId: string;
  type: 'access' | 'refresh';
  tokenVersion: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async signUp(dto: SignUpDto): Promise<AuthTokens> {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const email = dto.email.toLowerCase();

    // 사전 중복 검사(친절한 메시지). 경합 시에는 아래 catch 의 유니크 위반 처리가 보강한다.
    const existing = await this.prisma.user.findFirst({
      where: {
        companyCode: dto.companyCode,
        OR: [{ email }, { slackMemberId: dto.slackMemberId }],
      },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException(
        '같은 회사코드에 이미 가입된 이메일 또는 Slack 멤버 ID입니다.',
      );
    }

    // 회사코드에 가입자가 없으면 최초 가입자를 슈퍼관리자로 지정.
    const companyMembers = await this.prisma.user.count({
      where: { companyCode: dto.companyCode },
    });
    const role = companyMembers === 0 ? ROLES.SUPERADMIN : ROLES.EMPLOYEE;

    try {
      const user = await this.createUser({
        email,
        passwordHash,
        name: dto.name,
        slackMemberId: dto.slackMemberId,
        companyCode: dto.companyCode,
        role,
      });
      return this.issueTokens(user, user.tokenVersion);
    } catch (e) {
      // 동시 최초 가입 경합: 슈퍼관리자 유니크 인덱스 위반 → 사원으로 강등 생성
      if (role === ROLES.SUPERADMIN && this.isSuperadminUniqueViolation(e)) {
        const user = await this.createUser({
          email,
          passwordHash,
          name: dto.name,
          slackMemberId: dto.slackMemberId,
          companyCode: dto.companyCode,
          role: ROLES.EMPLOYEE,
        });
        return this.issueTokens(user, user.tokenVersion);
      }
      // 동시 중복 가입(email/slack 유니크) 경합
      if (this.isUniqueViolation(e)) {
        throw new BadRequestException(
          '같은 회사코드에 이미 가입된 이메일 또는 Slack 멤버 ID입니다.',
        );
      }
      throw e;
    }
  }

  private async createUser(data: {
    email: string;
    passwordHash: string;
    name: string;
    slackMemberId: string;
    companyCode: string;
    role: string;
  }): Promise<AuthUser & { tokenVersion: number }> {
    const user = await this.prisma.user.create({
      data,
      select: {
        id: true,
        email: true,
        name: true,
        slackMemberId: true,
        companyCode: true,
        role: true,
        tokenVersion: true,
      },
    });
    return { ...user, tokenVersion: user.tokenVersion ?? 0 };
  }

  private isUniqueViolation(e: unknown): boolean {
    return (
      e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
    );
  }

  private isSuperadminUniqueViolation(e: unknown): boolean {
    if (!this.isUniqueViolation(e)) return false;
    const target = (e as Prisma.PrismaClientKnownRequestError).meta?.target;
    return JSON.stringify(target ?? '').includes('superadmin');
  }

  async signIn(dto: SignInDto): Promise<AuthTokens> {
    const email = dto.loginId.trim().toLowerCase();

    const matches = await this.prisma.user.findMany({
      where: { email },
    });

    if (matches.length === 0) {
      throw new UnauthorizedException('로그인 정보가 올바르지 않습니다.');
    }

    if (matches.length > 1) {
      throw new BadRequestException(
        '동일한 이메일로 등록된 계정이 여러 개입니다. 관리자에게 문의하세요.',
      );
    }

    const user = matches[0];

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('로그인 정보가 올바르지 않습니다.');
    }

    const safeUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      slackMemberId: user.slackMemberId,
      companyCode: user.companyCode,
      role: user.role,
    };

    return this.issueTokens(safeUser, user.tokenVersion ?? 0);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException('유효하지 않은 refresh token입니다.');
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('유효하지 않은 refresh token입니다.');
    }

    const record = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        slackMemberId: true,
        companyCode: true,
        role: true,
        tokenVersion: true,
      },
    });
    if (!record) {
      throw new UnauthorizedException('인증 정보를 확인할 수 없습니다.');
    }
    // 로그아웃 등으로 tokenVersion 이 바뀐 refresh token 은 폐기된 것으로 간주한다.
    if ((payload.tokenVersion ?? 0) !== record.tokenVersion) {
      throw new UnauthorizedException('세션이 만료되었습니다. 다시 로그인하세요.');
    }

    const { tokenVersion, ...user } = record;
    return this.issueTokens(user, tokenVersion);
  }

  /** 로그아웃 — tokenVersion 을 증가시켜 발급된 모든 access/refresh 토큰을 폐기한다. */
  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<AuthUser> {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!existing) {
      throw new UnauthorizedException('인증 정보를 확인할 수 없습니다.');
    }

    if (!dto.name && !dto.slackMemberId && !dto.newPassword) {
      throw new BadRequestException('수정할 항목을 하나 이상 입력하세요.');
    }

    if (dto.newPassword) {
      if (!dto.currentPassword) {
        throw new BadRequestException('비밀번호 변경 시 현재 비밀번호가 필요합니다.');
      }
      const valid = await bcrypt.compare(dto.currentPassword, existing.passwordHash);
      if (!valid) {
        throw new UnauthorizedException('현재 비밀번호가 올바르지 않습니다.');
      }
    }

    if (dto.slackMemberId && dto.slackMemberId !== existing.slackMemberId) {
      const clash = await this.prisma.user.findFirst({
        where: {
          companyCode: existing.companyCode,
          slackMemberId: dto.slackMemberId,
          NOT: { id: userId },
        },
        select: { id: true },
      });
      if (clash) {
        throw new BadRequestException(
          '같은 회사코드에 이미 사용 중인 Slack 멤버 ID입니다.',
        );
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.slackMemberId !== undefined
          ? { slackMemberId: dto.slackMemberId.trim() }
          : {}),
        ...(dto.newPassword
          ? { passwordHash: await bcrypt.hash(dto.newPassword, 10) }
          : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        slackMemberId: true,
        companyCode: true,
        role: true,
      },
    });

    return user;
  }

  async getMe(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        slackMemberId: true,
        companyCode: true,
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('인증 정보를 확인할 수 없습니다.');
    }

    return user;
  }

  private async issueTokens(
    user: AuthUser,
    tokenVersion: number,
  ): Promise<AuthTokens> {
    const base = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyCode: user.companyCode,
      slackMemberId: user.slackMemberId,
      tokenVersion,
    };

    const accessExpiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '1h');
    const refreshExpiresIn = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    );

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...base, type: 'access' as const },
        { expiresIn: accessExpiresIn },
      ),
      this.jwtService.signAsync(
        { ...base, type: 'refresh' as const },
        { expiresIn: refreshExpiresIn },
      ),
    ]);

    return { accessToken, refreshToken, user };
  }
}
