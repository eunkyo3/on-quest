import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { SignInDto } from './dto/sign-in.dto';
import { SignUpDto } from './dto/sign-up.dto';

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
  role: string;
  companyCode: string;
  slackMemberId: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async signUp(dto: SignUpDto): Promise<{ accessToken: string; user: AuthUser }> {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          {
            email: dto.email,
            companyCode: dto.companyCode,
          },
          {
            slackMemberId: dto.slackMemberId,
            companyCode: dto.companyCode,
          },
        ],
      },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException(
        '같은 회사코드에 이미 가입된 이메일 또는 Slack 멤버 ID입니다.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        name: dto.name,
        slackMemberId: dto.slackMemberId,
        companyCode: dto.companyCode,
        role: dto.role ?? 'employee',
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

    const accessToken = await this.signToken(user);
    return { accessToken, user };
  }

  async signIn(dto: SignInDto): Promise<{ accessToken: string; user: AuthUser }> {
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

    const accessToken = await this.signToken(safeUser);
    return { accessToken, user: safeUser };
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

  private async signToken(user: AuthUser): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyCode: user.companyCode,
      slackMemberId: user.slackMemberId,
    };

    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '1h');
    return this.jwtService.signAsync(payload, { expiresIn });
  }
}
