import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { AiRateLimited } from '../../ai/decorators/ai-rate-limited.decorator';
import { OrganizerOnly } from '../../auth/decorators/organizer-only.decorator';
import { EventAiDraftResponseDto } from '../dto/event-ai-draft-response.dto';
import { GenerateEventDraftDto } from '../dto/generate-event-draft.dto';
import { EventAiDraftService } from './event-ai-draft.service';

const errorSchema = { $ref: '#/components/schemas/ErrorResponse' };

@ApiTags('events')
@Controller('events')
export class EventAiDraftController {
  constructor(private readonly eventAiDraftService: EventAiDraftService) {}

  @AiRateLimited()
  @OrganizerOnly()
  @Post('ai-draft')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Gera um rascunho de evento e lotes a partir de uma descrição',
    description:
      'Devolve um rascunho editável; nenhum evento é criado ou publicado. Campos que a IA não conseguiu inferir vêm nulos e listados em missingFields.',
  })
  @ApiOkResponse({ type: EventAiDraftResponseDto })
  @ApiBadRequestResponse({
    description: 'Descrição ausente, vazia ou longa demais.',
    schema: errorSchema,
  })
  @ApiUnprocessableEntityResponse({
    description: 'A IA não gerou um rascunho para essa descrição.',
    schema: errorSchema,
  })
  @ApiServiceUnavailableResponse({
    description:
      'IA indisponível, sem chave configurada ou com resposta inválida.',
    schema: errorSchema,
  })
  generate(
    @Body() dto: GenerateEventDraftDto,
  ): Promise<EventAiDraftResponseDto> {
    return this.eventAiDraftService.generate(dto);
  }
}
