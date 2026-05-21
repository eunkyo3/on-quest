import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { buildContentDisposition } from '../common/utils/content-disposition';
import { QuestService } from './quest.service';

/** Slack 등 외부에서 JWT 없이 서명 토큰으로 증빙을 조회 */
@Controller('quests')
export class QuestProofShareController {
  constructor(private readonly questService: QuestService) {}

  @Get(':id/proof/share')
  async shareProof(
    @Param('id') id: string,
    @Query('token') token: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (!token?.trim()) {
      throw new UnauthorizedException('유효하지 않은 공유 링크입니다.');
    }

    const proof = await this.questService.getProofViaShareToken(id, token.trim());
    if (!proof) {
      throw new NotFoundException('등록된 증빙 자료가 없습니다.');
    }

    const isImage = proof.mimeType.startsWith('image/');
    res.setHeader('Content-Type', proof.mimeType);
    res.setHeader(
      'Content-Disposition',
      buildContentDisposition(isImage ? 'inline' : 'attachment', proof.fileName),
    );
    res.send(proof.buffer);
  }
}
