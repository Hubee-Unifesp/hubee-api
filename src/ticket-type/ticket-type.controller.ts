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
} from '@nestjs/common';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';
import { UpdateTicketTypeDto } from './dto/update-ticket-type.dto';
import { TicketTypeService } from './ticket-type.service';
import { toResponse } from '../common/serialization/to-response';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';

@ApiTags('ticket-types')
@Controller('events/:eventId/ticket-types')
export class TicketTypeController {
  constructor(private readonly ticketTypeService: TicketTypeService) {}

  @AdminOnly()
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

  @Get()
  @ApiOkResponse({ type: TicketTypeResponseDto, isArray: true })
  async findAll(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return toResponse(
      TicketTypeResponseDto,
      await this.ticketTypeService.findAll(eventId),
    );
  }

  @Get(':id')
  @ApiOkResponse({ type: TicketTypeResponseDto })
  async findOne(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return toResponse(
      TicketTypeResponseDto,
      await this.ticketTypeService.findOne(eventId, id),
    );
  }

  @AdminOnly()
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

  @AdminOnly()
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
