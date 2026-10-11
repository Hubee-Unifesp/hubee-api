import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async register(data: RegisterDto) {
    const user = await this.usersService.create({
      fullName: data.fullName,
      email: data.email,
      password: data.password,
      signupIntent: data.signupIntent,
    });
    return {
      access_token: await this.jwtService.signAsync({
        sub: user.id,
        email: user.email,
        role: user.role,
      }),
      user,
    };
  }

  async me(id: string) {
    return this.usersService.findMe(id);
  }

  async login(email: string, pass: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user || !user.password || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const isMatch = await bcrypt.compare(pass, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };

    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }
}
