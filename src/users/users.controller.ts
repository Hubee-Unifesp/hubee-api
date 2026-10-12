import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { MeResponseDto, UserResponseDto } from './dto/user-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/decorators/current-user.decorator';
import { OrderService } from '../order/order.service';
import { QueryOrderDto } from '../order/dto/query-order.dto';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
} from '@nestjs/swagger';
import { toResponse } from '../common/serialization/to-response';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly orderService: OrderService,
  ) {}

  @Get('me')
  @ApiOkResponse({ type: MeResponseDto })
  async findMe(@CurrentUser() user: AuthenticatedUser) {
    return toResponse(MeResponseDto, await this.usersService.findMe(user.id));
  }

  @Patch('me')
  @ApiOkResponse({ type: MeResponseDto })
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() updateMeDto: UpdateMeDto,
  ) {
    return toResponse(
      MeResponseDto,
      await this.usersService.updateMe(user.id, updateMeDto),
    );
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    await this.usersService.changePassword(user.id, changePasswordDto);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async removeMe(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.usersService.remove(user.id);
  }

  @Post()
  @Roles('ADMIN')
  @ApiCreatedResponse({ type: UserResponseDto })
  async create(@Body() createUserDto: CreateUserDto) {
    return toResponse(
      UserResponseDto,
      await this.usersService.create(createUserDto),
    );
  }

  @Get()
  @Roles('ADMIN')
  @ApiOkResponse({ type: UserResponseDto, isArray: true })
  async findAll() {
    return toResponse(UserResponseDto, await this.usersService.findAll());
  }

  @Get('me/orders')
  async getMyOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryOrderDto,
  ) {
    return this.orderService.findAll({ ...query, userId: user.id });
  }

  @Get('me/tickets')
  async getMyTickets(@CurrentUser() _user: AuthenticatedUser) {
    return [];
  }

  @Get(':id')
  @Roles('ADMIN')
  @ApiOkResponse({ type: UserResponseDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return toResponse(UserResponseDto, await this.usersService.findOne(id));
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOkResponse({ type: UserResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return toResponse(
      UserResponseDto,
      await this.usersService.update(id, updateUserDto),
    );
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.usersService.remove(id);
  }
}
