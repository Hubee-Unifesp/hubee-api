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

@ApiTags('organization-events')
@Controller('events/:eventId/organizations')
export class OrganizationEventController {
  constructor(
    private readonly organizationEventService: OrganizationEventService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: OrganizationEventResponseDto })
  create(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: CreateOrganizationEventDto,
  ) {
    return this.organizationEventService.create(eventId, dto);
  }

  @Get()
  @ApiOkResponse({ type: OrganizationEventResponseDto, isArray: true })
  findAll(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.organizationEventService.findAll(eventId);
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
