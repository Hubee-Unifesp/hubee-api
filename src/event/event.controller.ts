import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { EventResponseDto } from './dto/event-response.dto';
import { EventPageResponseDto } from './dto/event-page-response.dto';
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
import { OrgAccess } from '../auth/decorators/org-access.decorator';
import {
  type AuthenticatedUser,
  CurrentUser,
} from '../auth/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@ApiTags('events')
@Controller('events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  /** ADMIN ou membro com `write` na organização informada em `organizerId`. */
  @OrgAccess('write', { from: 'body', field: 'organizerId' })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: EventResponseDto })
  async create(
    @Body() dto: CreateEventDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return toResponse(
      EventResponseDto,
      await this.eventService.create(dto, user),
    );
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  @ApiOkResponse({ type: EventPageResponseDto })
  @ApiBadRequestResponse({ description: 'Parâmetro de busca inválido' })
  async findAll(
    @Query() query: QueryEventDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return toResponse(
      EventPageResponseDto,
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

  /** Público; evento não publicado responde 404 para quem não é ADMIN nem membro da organização. */
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

  /**
   * ADMIN ou membro com `write` na organização do evento; de fora dá 404.
   * Mudar o status para `cancelled` exige `manage`, como o `DELETE`.
   */
  @OrgAccess('write', { from: 'event', param: 'id' })
  @Patch(':id')
  @ApiOkResponse({ type: EventResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return toResponse(
      EventResponseDto,
      await this.eventService.update(id, dto, user),
    );
  }

  /**
   * Cancela o evento. ADMIN ou administrador da organização (`manage`), pela
   * matriz RBAC (GOL-143); de fora dá 404.
   */
  @OrgAccess('manage', { from: 'event', param: 'id' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.eventService.cancel(id);
  }
}
