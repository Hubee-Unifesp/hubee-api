import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OrganizationUserResponseDto } from './dto/organization-user-response.dto';
import { RespondOrganizationInviteDto } from './dto/respond-organization-invite.dto';
import { UserInviteResponseDto } from './dto/user-invite-response.dto';
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
import { Authenticated } from '../auth/decorators/authenticated.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/decorators/current-user.decorator';
import { OrgAccess } from '../auth/decorators/org-access.decorator';

@ApiTags('organization-users')
@Controller()
export class OrganizationUsersController {
  constructor(
    private readonly organizationUsersService: OrganizationUsersService,
  ) {}

  @OrgAccess('manage', { from: 'org', param: 'orgId' })
  @Post('organizations/:orgId/users')
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

  @OrgAccess('manage', { from: 'org', param: 'orgId' })
  @Get('organizations/:orgId/users')
  @ApiOkResponse({ type: OrganizationUserResponseDto, isArray: true })
  async findAll(@Param('orgId', ParseUUIDPipe) orgId: string) {
    return toResponse(
      OrganizationUserResponseDto,
      await this.organizationUsersService.findAll(orgId),
    );
  }

  @Authenticated()
  @Get('users/me/invites')
  @ApiOkResponse({ type: UserInviteResponseDto, isArray: true })
  async findMyInvites(@CurrentUser() user: AuthenticatedUser) {
    return toResponse(
      UserInviteResponseDto,
      await this.organizationUsersService.findPendingInvitesByUser(user.id),
    );
  }

  @Authenticated()
  @Patch('organizations/:orgId/users/me')
  @ApiOkResponse({ type: OrganizationUserResponseDto })
  @ApiNotFoundResponse({
    description: 'Convite pendente não encontrado nesta organização.',
  })
  async respondToInvite(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RespondOrganizationInviteDto,
  ) {
    return toResponse(
      OrganizationUserResponseDto,
      await this.organizationUsersService.respondToInvite(orgId, user.id, dto),
    );
  }

  @OrgAccess('manage', { from: 'org', param: 'orgId' })
  @Patch('organizations/:orgId/users/:userId')
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

  @OrgAccess('manage', { from: 'org', param: 'orgId' })
  @Delete('organizations/:orgId/users/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async remove(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    await this.organizationUsersService.remove(orgId, userId);
  }
}
