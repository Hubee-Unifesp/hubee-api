import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export const EVENT_DRAFT_PROMPT_MAX_LENGTH = 2000;

export class GenerateEventDraftDto {
  @ApiProperty({
    description: 'Descrição do evento em linguagem natural',
    maxLength: EVENT_DRAFT_PROMPT_MAX_LENGTH,
    example:
      'Festa junina da engenharia no sábado que vem, das 20h às 2h, no Ginásio da Unifesp em São José dos Campos. 1º lote a R$ 30.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'A descrição do evento deve ser um texto.' })
  @IsNotEmpty({ message: 'Descreva o evento para gerar o rascunho.' })
  @MaxLength(EVENT_DRAFT_PROMPT_MAX_LENGTH, {
    message: `A descrição do evento deve ter no máximo ${EVENT_DRAFT_PROMPT_MAX_LENGTH} caracteres.`,
  })
  prompt: string;
}
