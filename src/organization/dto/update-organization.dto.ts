import {
  Equals,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  IsOptionalUpdate,
  TrimString,
} from '../../common/validation/update-validation';

export class UpdateOrganizationDto {
  @TrimString()
  @IsOptionalUpdate()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Equals(null, {
    message:
      'photoUrl aceita apenas null; use PATCH /organizations/:id/photo para enviar uma capa.',
  })
  photoUrl?: null;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, {
    message: 'titleColor deve estar no formato hexadecimal #RRGGBB.',
  })
  titleColor?: string | null;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, {
    message: 'descriptionColor deve estar no formato hexadecimal #RRGGBB.',
  })
  descriptionColor?: string | null;

  @IsOptional()
  @IsUUID()
  representativeId?: string;
}
