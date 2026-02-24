import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { User } from '../users/entities/user.entity';
import { ApplyVersionDto } from './dto/apply-version.dto';
import { CreateProcessDepartmentDto } from './dto/create-process-department.dto';
import { CreateProcessDto } from './dto/create-process.dto';
import { CreateVersionDto } from './dto/create-version.dto';
import { PushSubscribeDto } from './dto/push-subscribe.dto';
import { PushUnsubscribeDto } from './dto/push-unsubscribe.dto';
import { SetDepartmentUsersDto } from './dto/set-department-users.dto';
import { UpdateProcessDepartmentDto } from './dto/update-process-department.dto';
import { UpdateProcessDto } from './dto/update-process.dto';
import { UpdateVersionCorrectionsDto } from './dto/update-version-corrections.dto';
import { SuggestChecklistsDto } from './dto/suggest-checklists.dto';
import { ProcessesService } from './processes.service';

@Controller('processes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('processes_view')
export class ProcessesController {
  constructor(private readonly processes: ProcessesService) {}

  @Get('departments')
  getDepartmentTree(@CurrentUser() user: User) {
    return this.processes.getDepartmentTree(user);
  }

  @Get('users/candidates')
  @Permissions('processes_edit')
  getUsersForAssignment() {
    return this.processes.getUsersForAssignment();
  }

  @Get('push/public-key')
  getPushPublicKey() {
    return this.processes.getPushPublicKey();
  }

  @Post('push/subscribe')
  subscribePush(@CurrentUser() user: User, @Body() dto: PushSubscribeDto) {
    return this.processes.subscribePush(user, {
      endpoint: dto.endpoint,
      p256dh: dto.keys.p256dh,
      auth: dto.keys.auth,
      userAgent: dto.userAgent,
    });
  }

  @Post('push/unsubscribe')
  unsubscribePush(@CurrentUser() user: User, @Body() dto: PushUnsubscribeDto) {
    return this.processes.unsubscribePush(user, dto.endpoint);
  }

  @Get('departments/:id/users')
  @Permissions('processes_edit')
  getDepartmentUsers(@Param('id') id: string) {
    return this.processes.getDepartmentUsers(id);
  }

  @Put('departments/:id/users')
  @Permissions('processes_edit')
  setDepartmentUsers(
    @Param('id') id: string,
    @Body() dto: SetDepartmentUsersDto,
  ) {
    return this.processes.setDepartmentUsers(id, dto.userIds);
  }

  @Post('departments')
  @Permissions('processes_edit')
  createDepartment(@Body() dto: CreateProcessDepartmentDto) {
    return this.processes.createDepartment(dto);
  }

  @Put('departments/:id')
  @Permissions('processes_edit')
  updateDepartment(
    @Param('id') id: string,
    @Body() dto: UpdateProcessDepartmentDto,
  ) {
    return this.processes.updateDepartment(id, dto);
  }

  @Delete('departments/:id')
  @Permissions('processes_edit')
  async deleteDepartment(@Param('id') id: string) {
    await this.processes.deleteDepartment(id);
    return { success: true };
  }

  @Get('departments/:id/process-count')
  async getDepartmentProcessCount(@Param('id') id: string, @CurrentUser() user: User) {
    const count = await this.processes.getDepartmentProcessCount(id, user);
    return { count };
  }

  @Put('departments/:id/move-processes')
  @Permissions('processes_edit')
  async moveProcesses(
    @Param('id') id: string,
    @Body() body: { targetDepartmentId: string },
  ) {
    await this.processes.moveProcesses(id, body.targetDepartmentId);
    return { success: true };
  }

  @Get('departments/:id/items')
  getDepartmentProcesses(@Param('id') id: string, @CurrentUser() user: User) {
    return this.processes.getProcessesByDepartment(id, user);
  }

  @Post()
  @Permissions('processes_edit')
  createProcess(@Body() dto: CreateProcessDto, @CurrentUser() user: User) {
    return this.processes.createProcess(dto, user);
  }

  @Get('settings')
  @Permissions('processes_edit')
  getPolzaSettings() {
    return this.processes.getPolzaSettings();
  }

  @Put('settings')
  @Permissions('processes_edit')
  updatePolzaSettings(
    @Body() body: { apiKey?: string; baseUrl?: string; model?: string },
  ) {
    return this.processes.updatePolzaSettings(body);
  }

  @Get(':id')
  getProcess(@Param('id') id: string, @CurrentUser() user: User) {
    return this.processes.findProcessById(id, user);
  }

  @Put(':id')
  @Permissions('processes_edit')
  updateProcess(
    @Param('id') id: string,
    @Body() dto: UpdateProcessDto,
  ) {
    return this.processes.updateProcess(id, dto);
  }

  @Post(':id/versions')
  @Permissions('processes_edit')
  createVersion(
    @Param('id') processId: string,
    @Body() dto: CreateVersionDto,
    @CurrentUser() user: User,
  ) {
    return this.processes.createVersion(processId, dto, user);
  }

  @Post(':id/suggest-checklists')
  @Permissions('processes_edit')
  suggestChecklists(
    @Param('id') processId: string,
    @Body() dto: SuggestChecklistsDto,
    @CurrentUser() user: User,
  ) {
    return this.processes.suggestChecklists(processId, dto.text, user);
  }

  @Post(':id/approve')
  @Permissions('processes_edit')
  approveProcess(
    @Param('id') processId: string,
    @CurrentUser() user: User,
  ) {
    return this.processes.approveProcess(processId, user);
  }

  @Post(':id/read')
  markProcessAsRead(
    @Param('id') processId: string,
    @CurrentUser() user: User,
  ) {
    return this.processes.markProcessAsRead(processId, user);
  }

  @Post(':id/acknowledge')
  acknowledgeLatestVersion(
    @Param('id') processId: string,
    @CurrentUser() user: User,
  ) {
    return this.processes.acknowledgeLatestVersion(processId, user);
  }

  @Post(':id/force-acknowledge')
  @Permissions('processes_edit')
  forceAcknowledgeProcess(
    @Param('id') processId: string,
    @CurrentUser() user: User,
  ) {
    return this.processes.forceAcknowledgeProcess(processId, user);
  }

  @Get(':id/activity')
  getProcessActivity(
    @Param('id') processId: string,
    @Query('search') search: string | undefined,
    @CurrentUser() user: User,
  ) {
    return this.processes.getProcessActivity(processId, user, { search });
  }

  @Delete(':id')
  @Permissions('processes_edit')
  async deleteProcess(@Param('id') id: string) {
    await this.processes.deleteProcess(id);
    return { success: true };
  }

  @Get(':id/versions')
  getVersions(@Param('id') processId: string, @CurrentUser() user: User) {
    return this.processes.getVersions(processId, user);
  }

  @Get(':id/versions/:versionId')
  getVersion(
    @Param('id') processId: string,
    @Param('versionId') versionId: string,
    @CurrentUser() user: User,
  ) {
    return this.processes.getVersion(processId, versionId, user);
  }

  @Post(':id/versions/apply')
  @Permissions('processes_edit')
  applyVersion(
    @Param('id') processId: string,
    @Body() dto: ApplyVersionDto,
    @CurrentUser() user: User,
  ) {
    return this.processes.applyVersion(processId, dto.versionId, user);
  }

  @Patch(':id/versions/:versionId/corrections')
  @Permissions('processes_edit')
  updateVersionCorrections(
    @Param('id') processId: string,
    @Param('versionId') versionId: string,
    @Body() dto: UpdateVersionCorrectionsDto,
  ) {
    return this.processes.updateVersionCorrections(processId, versionId, dto);
  }

  @Post(':id/attachments')
  @Permissions('processes_edit')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage() }))
  uploadAttachment(
    @Param('id') processId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    return this.processes.uploadAttachment(processId, file, user);
  }

  @Get(':id/attachments/:attachmentId/download')
  async downloadAttachment(
    @Param('id') processId: string,
    @Param('attachmentId') attachmentId: string,
    @Res() res: Response,
  ) {
    const attachment = await this.processes.getAttachment(processId, attachmentId);
    return res.download(attachment.path, attachment.originalName);
  }

  @Delete(':id/attachments/:attachmentId')
  @Permissions('processes_edit')
  async deleteAttachment(
    @Param('id') processId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    await this.processes.deleteAttachment(processId, attachmentId);
    return { success: true };
  }
}
