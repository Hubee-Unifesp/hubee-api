import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OrganizationUserResponseDto } from './dto/organization-user-response.dto';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { OrganizationUsersService } from './organization-users.service';
import { CreateOrganizationUserDto } from './dto/create-organization-user.dto';
import { UpdateOrganizationUserDto } from './dto/update-organization-user.dto';
import { toResponse } from '../common/serialization/to-response';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';

@ApiTags('organization-users')
@AdminOnly()
@Controller('organizations/:orgId/users')
export class OrganizationUsersController {
  constructor(
    private readonly organizationUsersService: OrganizationUsersService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: OrganizationUserResponseDto })
  async create(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: CreateOrganizationUserDto,
  ) {
    return toResponse(
      OrganizationUserResponseDto,
      await this.organizationUsersService.create(orgId, dto),
    );
  }

  @Get()
  @ApiOkResponse({ type: OrganizationUserResponseDto, isArray: true })
  async findAll(@Param('orgId', ParseUUIDPipe) orgId: string) {
    return toResponse(
      OrganizationUserResponseDto,
      await this.organizationUsersService.findAll(orgId),
    );
  }

  @Patch(':userId')
  @ApiOkResponse({ type: OrganizationUserResponseDto })
  async update(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateOrganizationUserDto,
  ) {
    return toResponse(
      OrganizationUserResponseDto,
      await this.organizationUsersService.update(orgId, userId, dto),
    );
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async remove(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    await this.organizationUsersService.remove(orgId, userId);
  }
}
