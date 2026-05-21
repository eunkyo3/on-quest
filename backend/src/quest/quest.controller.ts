import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
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
import { QuestListQueryDto } from './dto/quest-list-query.dto';
import { ReviewQuestDto } from './dto/review-quest.dto';
import { UpdateQuestDto } from './dto/update-quest.dto';
import { AdminRoleGuard } from './guards/admin-role.guard';
import { buildContentDisposition } from '../common/utils/content-disposition';
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
  async list(
    @Query() query: QuestListQueryDto,
    @CurrentUser() user: QuestJwtUser,
  ) {
    return this.questService.findAll(user, query);
  }

  @Get('stats')
  async stats(@CurrentUser() user: QuestJwtUser) {
    return this.questService.getStats(user);
  }

  @Get('stats/by-assignee')
  @UseGuards(AdminRoleGuard)
  async statsByAssignee(@CurrentUser() user: QuestJwtUser) {
    return this.questService.getStatsByAssignee(user);
  }

  @Get('assignable-employees')
  @UseGuards(AdminRoleGuard)
  async assignableEmployees(@CurrentUser() user: QuestJwtUser) {
    return this.questService.listAssignableEmployees(user);
  }

  @Get(':id')
  async detail(@Param('id') id: string, @CurrentUser() user: QuestJwtUser) {
    return this.questService.findOne(id, user);
  }

  @Patch(':id')
  @UseGuards(AdminRoleGuard)
  async updateQuest(
    @Param('id') id: string,
    @Body() dto: UpdateQuestDto,
    @CurrentUser() user: QuestJwtUser,
  ) {
    return this.questService.updateQuest(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(AdminRoleGuard)
  async deleteQuest(
    @Param('id') id: string,
    @CurrentUser() user: QuestJwtUser,
  ) {
    await this.questService.deleteQuest(id, user);
    return { ok: true };
  }

  @Post(':id/start')
  async startQuest(
    @Param('id') id: string,
    @CurrentUser() user: QuestJwtUser,
  ) {
    return this.questService.startQuest(id, user);
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
      buildContentDisposition('attachment', proof.fileName),
    );
    res.send(proof.buffer);
  }

  @Get(':id/proof/preview')
  async previewProof(
    @Param('id') id: string,
    @Res() res: Response,
    @CurrentUser() user: QuestJwtUser,
  ) {
    const proof = await this.questService.getProof(id, user);
    if (!proof) throw new NotFoundException('등록된 증빙 자료가 없습니다.');
    const isImage = proof.mimeType.startsWith('image/');
    const isPdf = proof.mimeType === 'application/pdf';
    res.setHeader('Content-Type', proof.mimeType);
    res.setHeader(
      'Content-Disposition',
      buildContentDisposition(
        isImage || isPdf ? 'inline' : 'attachment',
        proof.fileName,
      ),
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
