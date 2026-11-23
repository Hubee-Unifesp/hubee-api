import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Authenticated } from '../auth/decorators/authenticated.decorator';
import {
  type AuthenticatedUser,
  CurrentUser,
} from '../auth/decorators/current-user.decorator';
import { toResponse } from '../common/serialization/to-response';
import {
  NotificationListResponseDto,
  NotificationResponseDto,
  ReadAllNotificationsResponseDto,
} from './dto/notification-response.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Authenticated()
  @Get()
  @ApiOperation({
    summary:
      'Lista as notificações do usuário autenticado e o contador de não lidas',
  })
  @ApiOkResponse({ type: NotificationListResponseDto })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryNotificationsDto,
  ) {
    return toResponse(
      NotificationListResponseDto,
      await this.notificationsService.findAllForUser(user.id, query),
    );
  }

  @Authenticated()
  @Patch('read-all')
  @ApiOperation({
    summary: 'Marca todas as notificações do usuário autenticado como lidas',
  })
  @ApiOkResponse({ type: ReadAllNotificationsResponseDto })
  async markAllAsRead(@CurrentUser() user: AuthenticatedUser) {
    return toResponse(
      ReadAllNotificationsResponseDto,
      await this.notificationsService.markAllAsRead(user.id),
    );
  }

  @Authenticated()
  @Patch(':id/read')
  @ApiOperation({
    summary: 'Marca uma notificação do usuário autenticado como lida',
  })
  @ApiOkResponse({ type: NotificationResponseDto })
  @ApiNotFoundResponse({ description: 'Notificação não encontrada' })
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return toResponse(
      NotificationResponseDto,
      await this.notificationsService.markAsRead(id, user.id),
    );
  }
}
