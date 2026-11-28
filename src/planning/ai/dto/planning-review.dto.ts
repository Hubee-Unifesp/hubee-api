import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export const REVIEW_SEVERITIES = ['critical', 'warning', 'info'] as const;
export type ReviewSeverity = (typeof REVIEW_SEVERITIES)[number];

export const REVIEW_ACTION_TYPES = [
  'filter_not_quoted',
  'filter_to_pay',
  'edit_expense',
  'edit_lots',
  'edit_audience',
] as const;
export type ReviewActionType = (typeof REVIEW_ACTION_TYPES)[number];

export class ReviewInsightActionDto {
  @Expose()
  @ApiProperty({ enum: REVIEW_ACTION_TYPES })
  type: ReviewActionType;

  @Expose()
  @ApiProperty({
    format: 'uuid',
    nullable: true,
    description: 'Despesa do evento, usada em edit_expense',
  })
  expenseId: string | null;
}

export class ReviewInsightDto {
  @Expose()
  @ApiProperty({ enum: REVIEW_SEVERITIES })
  severity: ReviewSeverity;

  @Expose()
  @ApiProperty({ maxLength: 120 })
  title: string;

  @Expose()
  @ApiProperty({ maxLength: 600 })
  detail: string;

  @Expose()
  @ApiProperty({ type: ReviewInsightActionDto, nullable: true })
  @Type(() => ReviewInsightActionDto)
  action: ReviewInsightActionDto | null;
}

export class PlanningReviewResponseDto {
  @Expose()
  @ApiProperty({
    type: ReviewInsightDto,
    isArray: true,
    description: 'No máximo 6 alertas, do mais grave para o menos grave',
  })
  @Type(() => ReviewInsightDto)
  insights: ReviewInsightDto[];

  @Expose()
  @ApiProperty({ description: 'Quando a análise foi gerada' })
  generatedAt: Date;
}
