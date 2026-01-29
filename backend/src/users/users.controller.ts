import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('roles')
  getRoles() {
    return this.users.getRoles();
  }

  @Get('permissions')
  getPermissions() {
    return this.users.getPermissions();
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('users')
  findAll() {
    return this.users.findAll();
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('users')
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('users')
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Put(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('users')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Post(':id/change-password')
  async changePassword(
    @Param('id') id: string,
    @Body() dto: ChangePasswordDto,
    @CurrentUser() current: User,
  ) {
    const hasUsersPermission = current.permissions?.some((p) => p.slug === 'users');
    if (id !== current.id && !hasUsersPermission)
      throw new ForbiddenException('Only users with "users" permission or self can change password');
    await this.users.changePassword(id, dto, hasUsersPermission);
    return { success: true };
  }
}
