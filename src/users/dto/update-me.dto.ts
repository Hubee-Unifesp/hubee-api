import { PickType } from '@nestjs/swagger';
import { UpdateUserDto } from './update-user.dto';

export class UpdateMeDto extends PickType(UpdateUserDto, [
  'fullName',
  'email',
  'phone',
  'cpf',
  'birthDate',
] as const) {}
