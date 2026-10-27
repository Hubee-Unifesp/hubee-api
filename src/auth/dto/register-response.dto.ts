import { Expose, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { LoginResponseDto } from './login-response.dto';
import { UserResponseDto } from '../../users/dto/user-response.dto';

export { MeResponseDto } from '../../users/dto/user-response.dto';

export class RegisterResponseDto extends LoginResponseDto {
  @Expose()
  @ApiProperty({ type: UserResponseDto })
  @Type(() => UserResponseDto)
  user: UserResponseDto;
}
