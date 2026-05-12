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
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { QuestJwtUser } from './quest-auth.types';
import { CreateQuestDto } from './dto/create-quest.dto';
import { ReviewQuestDto } from './dto/review-quest.dto';
import { AdminRoleGuard } from './guards/admin-role.guard';
import { QuestService } from './quest.service';

@Controller('quests')
@UseGuards(JwtAuthGuard)
export class QuestController {
  constructor(private readonly questService: QuestService) {}

  @Post()
  @UseGuards(AdminRoleGuard)
  async createQuest(
    @Body() dto: CreateQuestDto,
    @CurrentUser() user: QuestJwtUser,
  ) {
    return this.questService.createQuest(dto, user);
  }

  @Get()
  async list(@CurrentUser() user: QuestJwtUser) {
    return this.questService.findAll(user);
  }

  @Get('stats')
  async stats(@CurrentUser() user: QuestJwtUser) {
    return this.questService.getStats(user);
  }

  /** 관리자: 담당자별 퀘스트 통계 (배정 이력이 있는 사원만) */
  @Get('stats/by-assignee')
  @UseGuards(AdminRoleGuard)
  async statsByAssignee(@CurrentUser() user: QuestJwtUser) {
    return this.questService.getStatsByAssignee(user);
  }

  /** 관리자: 같은 회사코드 사원 목록 (발행 시 담당자 선택) */
  @Get('assignable-employees')
  @UseGuards(AdminRoleGuard)
  async assignableEmployees(@CurrentUser() user: QuestJwtUser) {
    return this.questService.listAssignableEmployees(user);
  }

  @Get(':id')
  async detail(@Param('id') id: string, @CurrentUser() user: QuestJwtUser) {
    return this.questService.findOne(id, user);
  }

  @Post(':id/proof')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadProof(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('submissionNote') submissionNote: string | undefined,
    @CurrentUser() user: QuestJwtUser,
  ) {
    if (!file) throw new BadRequestException('증빙 파일이 첨부되지 않았습니다.');
    return this.questService.uploadProof(
      id,
      {
        buffer: file.buffer,
        mimetype: file.mimetype,
        originalname: file.originalname,
      },
      user,
      submissionNote,
    );
  }

  @Get(':id/proof')
  async downloadProof(
    @Param('id') id: string,
    @Res() res: Response,
    @CurrentUser() user: QuestJwtUser,
  ) {
    const proof = await this.questService.getProof(id, user);
    if (!proof) throw new NotFoundException('등록된 증빙 자료가 없습니다.');
    res.setHeader('Content-Type', proof.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(proof.fileName)}"`,
    );
    res.send(proof.buffer);
  }

  @Patch(':id/review')
  @UseGuards(AdminRoleGuard)
  async reviewQuest(
    @Param('id') id: string,
    @Body() dto: ReviewQuestDto,
    @CurrentUser() user: QuestJwtUser,
  ) {
    return this.questService.reviewQuest(id, dto, user);
  }
}
