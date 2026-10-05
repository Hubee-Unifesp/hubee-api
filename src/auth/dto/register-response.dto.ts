import { ApiProperty } from '@nestjs/swagger';
import { LoginResponseDto } from './login-response.dto';
import { UserResponseDto } from '../../users/dto/user-response.dto';

export class RegisterResponseDto extends LoginResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;
}

export class MeResponseDto extends UserResponseDto {
  @ApiProperty()
  profileComplete: boolean;
}
