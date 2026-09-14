import { IsOptional, IsString } from 'class-validator';

export class QueryOrganizationDto {
  @IsOptional()
  @IsString()
  name?: string;
}
