import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OrganizationResponseDto } from './dto/organization-response.dto';
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
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { QueryOrganizationDto } from './dto/query-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationService } from './organization.service';
import { toResponse } from '../common/serialization/to-response';
import {
  ImageFileInterceptor,
  type ImageUploadFile,
} from '../common/validation/image-upload';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { Authenticated } from '../auth/decorators/authenticated.decorator';
import { OrgAccess } from '../auth/decorators/org-access.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/decorators/current-user.decorator';

@ApiTags('organizations')
@Controller('organizations')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Authenticated()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: OrganizationResponseDto })
  async create(
    @Body() dto: CreateOrganizationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return toResponse(
      OrganizationResponseDto,
      await this.organizationService.create(dto, user.id),
    );
  }

  @Get()
  @ApiOkResponse({ type: OrganizationResponseDto, isArray: true })
  async findAll(@Query() query: QueryOrganizationDto) {
    return toResponse(
      OrganizationResponseDto,
      await this.organizationService.findAll(query),
    );
  }

  @Get(':id')
  @ApiOkResponse({ type: OrganizationResponseDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return toResponse(
      OrganizationResponseDto,
      await this.organizationService.findOne(id),
    );
  }

  @OrgAccess('manage', { from: 'param', param: 'id' })
  @Patch(':id')
  @ApiOkResponse({ type: OrganizationResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return toResponse(
      OrganizationResponseDto,
      await this.organizationService.update(id, dto),
    );
  }

  @OrgAccess('manage', { from: 'param', param: 'id' })
  @Patch(':id/photo')
  @UseInterceptors(ImageFileInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Capa da organização (.jpg, .jpeg ou .png, até 2MB)',
        },
      },
    },
  })
  @ApiOkResponse({ type: OrganizationResponseDto })
  async updatePhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: ImageUploadFile,
  ) {
    return toResponse(
      OrganizationResponseDto,
      await this.organizationService.updatePhoto(id, file),
    );
  }

  @AdminOnly()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.organizationService.remove(id);
  }
}
