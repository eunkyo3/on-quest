import { ExtractJwt, Strategy } from 'passport-jwt';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { PrismaService } from '../../prisma/prisma.service';

interface JwtPayload {
  sub: string;
  email: string;
  name?: string;
  role: string;
  companyCode: string;
  slackMemberId: string;
  type?: 'access' | 'refresh';
}

export interface JwtUser {
  sub: string;
  email: string;
  name: string;
  role: string;
  companyCode: string;
  slackMemberId: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'change_this_jwt_secret'),
    });
  }

  /**
   * 토큰 검증 후, DB에서 사용자 최신 정보를 읽어 role 등 권한 필드를 갱신한다.
   * → 역할 변경(승격/강등)이 즉시 반영되고, 삭제된 계정의 토큰은 무효화된다.
   */
  async validate(payload: JwtPayload): Promise<JwtUser> {
    if (payload.type && payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        companyCode: true,
        slackMemberId: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException('인증 정보를 확인할 수 없습니다.');
    }

    return {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyCode: user.companyCode,
      slackMemberId: user.slackMemberId,
    };
  }
}
