import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OrderResponseDto } from './dto/order-response.dto';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderService } from './order.service';
import { toResponse } from '../common/serialization/to-response';

@ApiTags('orders')
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: OrderResponseDto })
  async create(@Body() dto: CreateOrderDto) {
    return toResponse(OrderResponseDto, await this.orderService.create(dto));
  }

  @Get()
  @ApiOkResponse({ type: OrderResponseDto, isArray: true })
  async findAll(@Query() query: QueryOrderDto) {
    return toResponse(OrderResponseDto, await this.orderService.findAll(query));
  }

  @Get(':id')
  @ApiOkResponse({ type: OrderResponseDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return toResponse(OrderResponseDto, await this.orderService.findOne(id));
  }

  @Patch(':id')
  @ApiOkResponse({ type: OrderResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderDto,
  ) {
    return toResponse(
      OrderResponseDto,
      await this.orderService.update(id, dto),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.orderService.cancel(id);
  }
}
