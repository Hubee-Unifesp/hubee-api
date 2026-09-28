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

@ApiTags('organization-users')
@Controller('organizations/:orgId/users')
export class OrganizationUsersController {
  constructor(
    private readonly organizationUsersService: OrganizationUsersService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: OrganizationUserResponseDto })
  create(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: CreateOrganizationUserDto,
  ) {
    return this.organizationUsersService.create(orgId, dto);
  }

  @Get()
  @ApiOkResponse({ type: OrganizationUserResponseDto, isArray: true })
  findAll(@Param('orgId', ParseUUIDPipe) orgId: string) {
    return this.organizationUsersService.findAll(orgId);
  }

  @Patch(':userId')
  @ApiOkResponse({ type: OrganizationUserResponseDto })
  update(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateOrganizationUserDto,
  ) {
    return this.organizationUsersService.update(orgId, userId, dto);
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
