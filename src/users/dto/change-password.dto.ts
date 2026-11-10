import { IsNotEmpty, IsString, Length } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'A senha atual é obrigatória' })
  currentPassword: string;

  @IsString()
  @IsNotEmpty()
  @Length(8, 72, { message: 'A senha deve ter entre 8 e 72 caracteres' })
  newPassword: string;
}
