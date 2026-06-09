import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ROLES } from '../common/roles';
import type { QuestJwtUser } from '../quest/quest-auth.types';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UserService } from './user.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.SUPERADMIN)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list(@CurrentUser() user: QuestJwtUser) {
    return this.userService.listCompanyUsers(user);
  }

  @Get('audit-logs')
  async auditLogs(
    @CurrentUser() user: QuestJwtUser,
    @Query('limit') limit?: string,
  ) {
    return this.audit.list(user.companyCode, limit ? Number(limit) : 100);
  }

  @Patch(':id/role')
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: QuestJwtUser,
  ) {
    return this.userService.updateRole(id, dto, user);
  }

  @Post(':id/transfer-ownership')
  async transferOwnership(
    @Param('id') id: string,
    @CurrentUser() user: QuestJwtUser,
  ) {
    return this.userService.transferOwnership(id, user);
  }
}
