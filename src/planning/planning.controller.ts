import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrgAccess } from '../auth/decorators/org-access.decorator';
import { toResponse } from '../common/serialization/to-response';
import { PlanningSummaryResponseDto } from './dto/planning-summary-response.dto';
import { QueryPlanningSummaryDto } from './dto/query-planning-summary.dto';
import { PlanningService } from './planning.service';

@ApiTags('planning')
@Controller('events/:eventId/planning')
export class PlanningController {
  constructor(private readonly planningService: PlanningService) {}

  @OrgAccess('write', { from: 'event', param: 'eventId' })
  @Get('summary')
  @ApiOperation({
    summary: 'Resumo financeiro e break-even do planejamento do evento',
    description:
      'Totais de despesas (sem as canceladas), lotes na ordem de venda e o resultado do evento para o público pedido, com cenários de −40 a +40 pessoas.',
  })
  @ApiOkResponse({ type: PlanningSummaryResponseDto })
  async getSummary(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Query() query: QueryPlanningSummaryDto,
  ) {
    return toResponse(
      PlanningSummaryResponseDto,
      await this.planningService.getSummary(eventId, query.audience),
    );
  }
}
