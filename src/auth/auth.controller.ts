import { RegisterDto } from './dto/register.dto';
import {
  RegisterResponseDto,
  MeResponseDto,
} from './dto/register-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from './decorators/current-user.decorator';
import {
  ApiOkResponse,
  ApiTags,
  ApiBearerAuth,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Get,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { toResponse } from '../common/serialization/to-response';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiCreatedResponse({ type: RegisterResponseDto })
  async register(@Body() data: RegisterDto) {
    return toResponse(
      RegisterResponseDto,
      await this.authService.register(data),
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MeResponseDto })
  async me(@CurrentUser() user: AuthenticatedUser) {
    return toResponse(MeResponseDto, await this.authService.me(user.id));
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOkResponse({ type: LoginResponseDto })
  async login(@Body() loginDto: LoginDto) {
    return toResponse(
      LoginResponseDto,
      await this.authService.login(loginDto.email, loginDto.password),
    );
  }
}
