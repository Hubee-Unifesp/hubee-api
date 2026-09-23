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

@Controller('eventos/:eventId/organizacoes')
export class OrganizationEventController {
  constructor(
    private readonly organizationEventService: OrganizationEventService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: CreateOrganizationEventDto,
  ) {
    return this.organizationEventService.create(eventId, dto);
  }

  @Get()
  findAll(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.organizationEventService.findAll(eventId);
  }

  @Delete(':orgId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('orgId', ParseUUIDPipe) orgId: string,
  ): Promise<void> {
    await this.organizationEventService.remove(eventId, orgId);
  }
}
