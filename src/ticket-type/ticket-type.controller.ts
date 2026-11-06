import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TicketTypeResponseDto } from './dto/ticket-type-response.dto';
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
  UseGuards,
} from '@nestjs/common';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';
import { UpdateTicketTypeDto } from './dto/update-ticket-type.dto';
import { TicketTypeService } from './ticket-type.service';
import { toResponse } from '../common/serialization/to-response';
import { OrgAccess } from '../auth/decorators/org-access.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/decorators/current-user.decorator';

@ApiTags('ticket-types')
@Controller('events/:eventId/ticket-types')
export class TicketTypeController {
  constructor(private readonly ticketTypeService: TicketTypeService) {}

  @OrgAccess('write', { from: 'event', param: 'eventId' })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: TicketTypeResponseDto })
  async create(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: CreateTicketTypeDto,
  ) {
    return toResponse(
      TicketTypeResponseDto,
      await this.ticketTypeService.create(eventId, dto),
    );
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  @ApiOkResponse({ type: TicketTypeResponseDto, isArray: true })
  async findAll(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @CurrentUser() viewer?: AuthenticatedUser,
  ) {
    return toResponse(
      TicketTypeResponseDto,
      await this.ticketTypeService.findAll(eventId, viewer),
    );
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  @ApiOkResponse({ type: TicketTypeResponseDto })
  async findOne(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() viewer?: AuthenticatedUser,
  ) {
    return toResponse(
      TicketTypeResponseDto,
      await this.ticketTypeService.findVisible(eventId, id, viewer),
    );
  }

  @OrgAccess('write', { from: 'event', param: 'eventId' })
  @Patch(':id')
  @ApiOkResponse({ type: TicketTypeResponseDto })
  async update(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketTypeDto,
  ) {
    return toResponse(
      TicketTypeResponseDto,
      await this.ticketTypeService.update(eventId, id, dto),
    );
  }

  @OrgAccess('write', { from: 'event', param: 'eventId' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async remove(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.ticketTypeService.remove(eventId, id);
  }
}
