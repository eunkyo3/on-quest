import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CreateQuestDto } from './dto/create-quest.dto';
import { ReviewQuestDto } from './dto/review-quest.dto';
import { QuestService } from './quest.service';

/**
 * Quest REST API
 *  - POST   /quests                  : 퀘스트 생성 (관리자)
 *  - GET    /quests                  : 퀘스트 목록 조회
 *  - GET    /quests/stats            : 전체 진행률 통계
 *  - GET    /quests/:id              : 단건 조회
 *  - POST   /quests/:id/proof        : 증빙자료 업로드 (신입, multipart/form-data)
 *  - GET    /quests/:id/proof        : 증빙자료 다운로드
 *  - PATCH  /quests/:id/review       : 관리자 검토 (완료/반려 + 피드백)
 */
@Controller('quests')
export class QuestController {
  constructor(private readonly questService: QuestService) {}

  @Post()
  async createQuest(@Body() dto: CreateQuestDto) {
    return this.questService.createQuest(dto);
  }

  @Get()
  async list() {
    return this.questService.findAll();
  }

  @Get('stats')
  async stats() {
    return this.questService.getStats();
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.questService.findOne(id);
  }

  @Post(':id/proof')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB (BLOB 저장 이슈 최소화)
    }),
  )
  async uploadProof(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('증빙 파일이 첨부되지 않았습니다.');
    return this.questService.uploadProof(id, {
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname,
    });
  }

  @Get(':id/proof')
  async downloadProof(@Param('id') id: string, @Res() res: Response) {
    const proof = await this.questService.getProof(id);
    if (!proof) throw new NotFoundException('등록된 증빙 자료가 없습니다.');
    res.setHeader('Content-Type', proof.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(proof.fileName)}"`,
    );
    res.send(proof.buffer);
  }

  @Patch(':id/review')
  async reviewQuest(
    @Param('id') id: string,
    @Body() dto: ReviewQuestDto,
  ) {
    return this.questService.reviewQuest(id, dto);
  }
}
