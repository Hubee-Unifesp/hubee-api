import { jest } from '@jest/globals';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginResponseDto } from './dto/login-response.dto';
import {
  MeResponseDto,
  RegisterResponseDto,
} from './dto/register-response.dto';
import { UserResponseDto } from '../users/dto/user-response.dto';

/** Linha completa do banco, incluindo os campos internos. */
const userRow = {
  id: 'user-id',
  fullName: 'Pessoa Teste',
  email: 'user@example.com',
  phone: null,
  password: '$2b$10$hash',
  cpf: null,
  birthDate: null,
  role: 'USER' as const,
  signupIntent: 'BUY' as const,
  status: 'ACTIVE',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  deletedAt: null,
};
const { password: _password, deletedAt: _deletedAt, ...publicUser } = userRow;

describe('AuthController', () => {
  let controller: AuthController;
  const authService = {
    register: jest.fn<AuthService['register']>(),
    me: jest.fn<AuthService['me']>(),
    login: jest.fn<AuthService['login']>(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('POST /auth/register retorna token e usuário sem campos internos', async () => {
    authService.register.mockResolvedValue({
      access_token: 'jwt',
      user: userRow,
    } as never);

    const result = await controller.register({
      fullName: 'Pessoa Teste',
      email: 'user@example.com',
      password: 'secret123',
    });

    expect(result).toBeInstanceOf(RegisterResponseDto);
    expect(result.user).toBeInstanceOf(UserResponseDto);
    expect(result).toEqual({ access_token: 'jwt', user: publicUser });
  });

  it('GET /auth/me retorna o MeResponseDto sem campos internos', async () => {
    authService.me.mockResolvedValue({
      ...userRow,
      profileComplete: false,
    } as never);

    const result = await controller.me({
      id: 'user-id',
      email: 'user@example.com',
      role: 'USER',
    });

    expect(authService.me).toHaveBeenCalledWith('user-id');
    expect(result).toBeInstanceOf(MeResponseDto);
    expect(result).toEqual({ ...publicUser, profileComplete: false });
  });

  it('POST /auth/login retorna só o access_token', async () => {
    authService.login.mockResolvedValue({ access_token: 'jwt' });

    const result = await controller.login({
      email: 'user@example.com',
      password: 'secret123',
    });

    expect(authService.login).toHaveBeenCalledWith(
      'user@example.com',
      'secret123',
    );
    expect(result).toBeInstanceOf(LoginResponseDto);
    expect(result).toEqual({ access_token: 'jwt' });
  });
});
