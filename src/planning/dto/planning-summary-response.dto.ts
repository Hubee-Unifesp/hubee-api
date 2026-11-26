import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import {
  expenseGroup,
  ticketTypeModality,
  type ExpenseGroup,
  type TicketTypeModality,
} from '../../database/schema';

export class PlanningExpensesByGroupDto {
  @Expose()
  @ApiProperty({ example: 10010 })
  fixed: number;

  @Expose()
  @ApiProperty({ example: 4803.47 })
  variable: number;

  @Expose()
  @ApiProperty({ example: 690.47 })
  marketing: number;
}

export class PlanningExpensesSummaryDto {
  @Expose()
  @ApiProperty({
    description: 'Total das despesas, sem as canceladas.',
    example: 15503.94,
  })
  total: number;

  @Expose()
  @Type(() => PlanningExpensesByGroupDto)
  @ApiProperty({ type: PlanningExpensesByGroupDto })
  byGroup: PlanningExpensesByGroupDto;

  @Expose()
  @ApiProperty({ description: 'Total das despesas pagas.', example: 5000 })
  paidTotal: number;

  @Expose()
  @ApiProperty({
    description: 'Total das despesas ainda não pagas.',
    example: 10503.94,
  })
  pendingTotal: number;

  @Expose()
  @ApiProperty({ example: 6 })
  itemCount: number;

  @Expose()
  @ApiProperty({ example: 3 })
  quotedCount: number;
}

export class PlanningCategoryTotalDto {
  @Expose()
  @ApiProperty({ example: 'Estrutura' })
  category: string;

  @Expose()
  @ApiProperty({ enum: expenseGroup.enumValues })
  group: ExpenseGroup;

  @Expose()
  @ApiProperty({ example: 8040 })
  total: number;
}

export class PlanningPendingSummaryDto {
  @Expose()
  @ApiProperty({
    description: 'Itens com valor maior que zero ainda não pagos.',
    example: 4,
  })
  toPay: number;

  @Expose()
  @ApiProperty({ description: 'Itens ainda não cotados.', example: 3 })
  notQuoted: number;
}

export class PlanningLotRangeDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  id: string;

  @Expose()
  @ApiProperty({ example: '1º Lote' })
  batch: string;

  @Expose()
  @ApiProperty({ example: 50 })
  price: number;

  @Expose()
  @ApiProperty({ description: 'Quantidade planejada do lote.', example: 85 })
  quantity: number;

  @Expose()
  @ApiProperty({ enum: ticketTypeModality.enumValues })
  modality: TicketTypeModality;

  @Expose()
  @ApiProperty({
    description:
      'true para lote da fila de venda (`inteira`); false para cota paralela (`meia`, `estudante`, `vip`, `cortesia`), que entra com a quantidade planejada. Sem lote `inteira`, todos os lotes formam a fila.',
  })
  sequential: boolean;

  @Expose()
  @ApiProperty({
    nullable: true,
    description:
      'Primeiro ingresso do público pedido vendido neste lote (null se o lote não vende nenhum).',
    example: 81,
  })
  start: number | null;

  @Expose()
  @ApiProperty({
    nullable: true,
    description: 'Último ingresso do público pedido vendido neste lote.',
    example: 165,
  })
  end: number | null;
}

export class PlanningTicketsSummaryDto {
  @Expose()
  @ApiProperty({
    description: 'Soma das quantidades dos lotes.',
    example: 300,
  })
  planned: number;

  @Expose()
  @Type(() => PlanningLotRangeDto)
  @ApiProperty({
    type: PlanningLotRangeDto,
    isArray: true,
    description:
      'Lotes da fila de venda na ordem de venda (data de início, depois preço), seguidos das cotas paralelas.',
  })
  lots: PlanningLotRangeDto[];
}

export class PlanningResultDto {
  @Expose()
  @ApiProperty({ nullable: true, example: 300 })
  audience: number | null;

  @Expose()
  @ApiProperty({ nullable: true, example: 15724.9 })
  revenue: number | null;

  @Expose()
  @ApiProperty({ nullable: true, example: 52.42 })
  averageTicket: number | null;

  @Expose()
  @ApiProperty({
    nullable: true,
    description: 'Ingressos necessários para cobrir as despesas.',
    example: 295.78,
  })
  breakEven: number | null;

  @Expose()
  @ApiProperty({ nullable: true, example: 51.68 })
  costPerPerson: number | null;

  @Expose()
  @ApiProperty({ nullable: true, example: 220.96 })
  profit: number | null;

  @Expose()
  @ApiProperty({
    nullable: true,
    description:
      'Lote em que a receita acumulada cobre as despesas (cotas paralelas primeiro, depois a fila).',
    example: '3º Lote',
  })
  breakEvenBatch: string | null;
}

export class PlanningSummaryResponseDto {
  @Expose()
  @ApiProperty({
    nullable: true,
    description: 'Público esperado salvo no evento.',
    example: 300,
  })
  expectedAudience: number | null;

  @Expose()
  @Type(() => PlanningExpensesSummaryDto)
  @ApiProperty({ type: PlanningExpensesSummaryDto })
  expenses: PlanningExpensesSummaryDto;

  @Expose()
  @Type(() => PlanningCategoryTotalDto)
  @ApiProperty({
    type: PlanningCategoryTotalDto,
    isArray: true,
    description: 'Totais por categoria, do maior para o menor.',
  })
  byCategory: PlanningCategoryTotalDto[];

  @Expose()
  @Type(() => PlanningPendingSummaryDto)
  @ApiProperty({ type: PlanningPendingSummaryDto })
  pending: PlanningPendingSummaryDto;

  @Expose()
  @Type(() => PlanningTicketsSummaryDto)
  @ApiProperty({ type: PlanningTicketsSummaryDto })
  tickets: PlanningTicketsSummaryDto;

  @Expose()
  @Type(() => PlanningResultDto)
  @ApiProperty({
    type: PlanningResultDto,
    description: 'Resultado do evento para o público pedido.',
  })
  result: PlanningResultDto;

  @Expose()
  @Type(() => PlanningResultDto)
  @ApiProperty({
    type: PlanningResultDto,
    isArray: true,
    description:
      'O mesmo resultado para público −40, −20, 0, +20 e +40 (sem valores ≤ 0).',
  })
  scenarios: PlanningResultDto[];
}
