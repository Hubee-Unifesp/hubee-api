import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AiRateLimited } from '../../ai/decorators/ai-rate-limited.decorator';
import { OrgAccess } from '../../auth/decorators/org-access.decorator';
import {
  ExpenseSuggestionsRequestDto,
  ExpenseSuggestionsResponseDto,
} from './dto/expense-suggestions.dto';
import { PlanningReviewResponseDto } from './dto/planning-review.dto';
import { PlanningAiService } from './planning-ai.service';

const errorSchema = { $ref: '#/components/schemas/ErrorResponse' };

@ApiTags('planning')
@Controller('events/:eventId/planning/ai')
export class PlanningAiController {
  constructor(private readonly planningAi: PlanningAiService) {}

  @AiRateLimited()
  @OrgAccess('write', { from: 'event', param: 'eventId' })
  @Post('expense-suggestions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sugere despesas para o orçamento do evento com IA',
    description:
      'Usa os dados do evento, os lotes e as despesas já cadastradas para sugerir até 30 despesas que faltam. Nada é salvo.',
  })
  @ApiOkResponse({ type: ExpenseSuggestionsResponseDto })
  @ApiBadRequestResponse({
    description: 'Observações longas demais.',
    schema: errorSchema,
  })
  @ApiServiceUnavailableResponse({
    description:
      'IA indisponível, sem chave configurada ou com resposta inválida.',
    schema: errorSchema,
  })
  suggestExpenses(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: ExpenseSuggestionsRequestDto,
  ): Promise<ExpenseSuggestionsResponseDto> {
    return this.planningAi.suggestExpenses(eventId, dto.notes);
  }

  @AiRateLimited()
  @OrgAccess('write', { from: 'event', param: 'eventId' })
  @Post('review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Analisa o planejamento do evento com IA',
    description:
      'Calcula no código os fatos do planejamento (resumo financeiro, prazo, itens sem cotação, pagamentos vencidos e maiores categorias) e pede à IA até 6 alertas com recomendações. Os números vêm sempre do cálculo da API. Nada é salvo.',
  })
  @ApiOkResponse({ type: PlanningReviewResponseDto })
  @ApiServiceUnavailableResponse({
    description:
      'IA indisponível, sem chave configurada ou com resposta inválida.',
    schema: errorSchema,
  })
  review(
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ): Promise<PlanningReviewResponseDto> {
    return this.planningAi.reviewPlanning(eventId);
  }
}
