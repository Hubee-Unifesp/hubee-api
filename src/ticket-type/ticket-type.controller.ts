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

@ApiTags('ticket-types')
@Controller('events/:eventId/ticket-types')
export class TicketTypeController {
  constructor(private readonly ticketTypeService: TicketTypeService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: TicketTypeResponseDto })
  create(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: CreateTicketTypeDto,
  ) {
    return this.ticketTypeService.create(eventId, dto);
  }

  @Get()
  @ApiOkResponse({ type: TicketTypeResponseDto, isArray: true })
  findAll(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.ticketTypeService.findAll(eventId);
  }

  @Get(':id')
  @ApiOkResponse({ type: TicketTypeResponseDto })
  findOne(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ticketTypeService.findOne(eventId, id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: TicketTypeResponseDto })
  update(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketTypeDto,
  ) {
    return this.ticketTypeService.update(eventId, id, dto);
  }

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
