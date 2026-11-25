import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
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

  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  photoUrl?: string | null;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  titleColor?: string | null;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  descriptionColor?: string | null;

  @IsOptional()
  @IsUUID()
  representativeId?: string;
}
