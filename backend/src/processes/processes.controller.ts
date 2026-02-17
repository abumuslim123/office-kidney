import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
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
import { UpdateProcessDepartmentDto } from './dto/update-process-department.dto';
import { UpdateProcessDto } from './dto/update-process.dto';
import { UpdateVersionCorrectionsDto } from './dto/update-version-corrections.dto';
import { ProcessesService } from './processes.service';

@Controller('processes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('processes_view')
export class ProcessesController {
  constructor(private readonly processes: ProcessesService) {}

  @Get('departments')
  getDepartmentTree() {
    return this.processes.getDepartmentTree();
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

  @Get('departments/:id/items')
  getDepartmentProcesses(@Param('id') id: string) {
    return this.processes.getProcessesByDepartment(id);
  }

  @Post()
  @Permissions('processes_edit')
  createProcess(@Body() dto: CreateProcessDto, @CurrentUser() user: User) {
    return this.processes.createProcess(dto, user);
  }

  @Get(':id')
  getProcess(@Param('id') id: string) {
    return this.processes.findProcessById(id);
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

  @Delete(':id')
  @Permissions('processes_edit')
  async deleteProcess(@Param('id') id: string) {
    await this.processes.deleteProcess(id);
    return { success: true };
  }

  @Get(':id/versions')
  getVersions(@Param('id') processId: string) {
    return this.processes.getVersions(processId);
  }

  @Get(':id/versions/:versionId')
  getVersion(
    @Param('id') processId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.processes.getVersion(processId, versionId);
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
