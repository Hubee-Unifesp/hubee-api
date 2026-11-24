import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AiRateLimited } from '../../ai/decorators/ai-rate-limited.decorator';
import { OrganizerOnly } from '../../auth/decorators/organizer-only.decorator';
import {
  EventAiAssistantTurnDto,
  EventAiAssistantTurnResponseDto,
} from './dto/event-ai-assistant.dto';
import { EventAiAssistantService } from './event-ai-assistant.service';

const errorSchema = { $ref: '#/components/schemas/ErrorResponse' };

@ApiTags('events')
@Controller('events/ai-assistant')
export class EventAiAssistantController {
  constructor(private readonly assistant: EventAiAssistantService) {}

  @AiRateLimited()
  @OrganizerOnly()
  @Post('turn')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Processa uma rodada da conversa de criação de evento com IA',
    description:
      'Recebe o rascunho atual, o campo perguntado e a resposta do organizador. Devolve o rascunho atualizado, a próxima pergunta e done. Nenhum evento é criado.',
  })
  @ApiOkResponse({ type: EventAiAssistantTurnResponseDto })
  @ApiBadRequestResponse({
    description: 'Resposta ausente, longa demais ou rascunho inválido.',
    schema: errorSchema,
  })
  @ApiServiceUnavailableResponse({
    description:
      'IA indisponível, sem chave configurada ou com resposta inválida.',
    schema: errorSchema,
  })
  turn(
    @Body() dto: EventAiAssistantTurnDto,
  ): Promise<EventAiAssistantTurnResponseDto> {
    return this.assistant.turn(dto);
  }
}
