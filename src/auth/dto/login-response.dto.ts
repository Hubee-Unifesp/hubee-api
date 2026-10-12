import { Expose } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/** Contrato de saída do login: o token JWT de acesso. */
export class LoginResponseDto {
  @Expose()
  @ApiProperty({ description: 'Token JWT de acesso (Bearer).' })
  access_token: string;
}
