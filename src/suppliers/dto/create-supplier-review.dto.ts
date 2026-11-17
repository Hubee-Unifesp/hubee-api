import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TrimString } from '../../common/validation/update-validation';

export class CreateSupplierReviewDto {
  @ApiProperty({ minimum: 1, maximum: 5, example: 5 })
  @IsNotEmpty({ message: 'A nota é obrigatória.' })
  @IsInt({ message: 'A nota deve ser um número inteiro.' })
  @Min(1, { message: 'A nota deve ser entre 1 e 5.' })
  @Max(5, { message: 'A nota deve ser entre 1 e 5.' })
  rating: number;

  @ApiProperty({
    required: false,
    maxLength: 500,
    example: 'Buffet pontual e muito bem servido.',
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'O comentário deve ser um texto.' })
  @MaxLength(500, {
    message: 'O comentário deve ter no máximo 500 caracteres.',
  })
  comment?: string;
}
