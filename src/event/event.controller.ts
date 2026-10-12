import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { EventResponseDto } from './dto/event-response.dto';
import { EventSummaryResponseDto } from './dto/event-summary-response.dto';
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
  UseGuards,
} from '@nestjs/common';
import { CreateEventDto } from './dto/create-event.dto';
import { QueryEventDto } from './dto/query-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventService } from './event.service';
import { toResponse } from '../common/serialization/to-response';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import {
  type AuthenticatedUser,
  CurrentUser,
} from '../auth/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@ApiTags('events')
@Controller('events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @AdminOnly()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: EventResponseDto })
  async create(@Body() dto: CreateEventDto) {
    return toResponse(EventResponseDto, await this.eventService.create(dto));
  }

  /** Público; sem token de ADMIN, só lista eventos publicados. */
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  @ApiOkResponse({ type: EventResponseDto, isArray: true })
  async findAll(
    @Query() query: QueryEventDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return toResponse(
      EventResponseDto,
      await this.eventService.findAll(query, user),
    );
  }

  @Get('summary')
  @ApiOkResponse({ type: EventSummaryResponseDto, isArray: true })
  async findUpcomingSummaries() {
    return toResponse(
      EventSummaryResponseDto,
      await this.eventService.findUpcomingSummaries(),
    );
  }

  /** Público; sem token de ADMIN, evento não publicado responde 404. */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  @ApiOkResponse({ type: EventResponseDto })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return toResponse(
      EventResponseDto,
      await this.eventService.findVisible(id, user),
    );
  }

  @AdminOnly()
  @Patch(':id')
  @ApiOkResponse({ type: EventResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventDto,
  ) {
    return toResponse(
      EventResponseDto,
      await this.eventService.update(id, dto),
    );
  }

  @AdminOnly()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.eventService.cancel(id);
  }
}
