import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OrganizationEventResponseDto } from './dto/organization-event-response.dto';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CreateOrganizationEventDto } from './dto/create-organization-event.dto';
import { OrganizationEventService } from './organization-event.service';
import { toResponse } from '../common/serialization/to-response';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';

@ApiTags('organization-events')
@AdminOnly()
@Controller('events/:eventId/organizations')
export class OrganizationEventController {
  constructor(
    private readonly organizationEventService: OrganizationEventService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: OrganizationEventResponseDto })
  async create(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: CreateOrganizationEventDto,
  ) {
    return toResponse(
      OrganizationEventResponseDto,
      await this.organizationEventService.create(eventId, dto),
    );
  }

  @Get()
  @ApiOkResponse({ type: OrganizationEventResponseDto, isArray: true })
  async findAll(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return toResponse(
      OrganizationEventResponseDto,
      await this.organizationEventService.findAll(eventId),
    );
  }

  @Delete(':orgId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async remove(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('orgId', ParseUUIDPipe) orgId: string,
  ): Promise<void> {
    await this.organizationEventService.remove(eventId, orgId);
  }
}
