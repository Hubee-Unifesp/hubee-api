import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SupplierResponseDto } from './dto/supplier-response.dto';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  ParseUUIDPipe,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { toResponse } from '../common/serialization/to-response';

@ApiTags('suppliers')
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @ApiCreatedResponse({ type: SupplierResponseDto })
  async create(@Body() createSupplierDto: CreateSupplierDto) {
    return toResponse(
      SupplierResponseDto,
      await this.suppliersService.create(createSupplierDto),
    );
  }

  @Get()
  @ApiOkResponse({ type: SupplierResponseDto, isArray: true })
  async findAll() {
    return toResponse(
      SupplierResponseDto,
      await this.suppliersService.findAll(),
    );
  }

  @Get(':id')
  @ApiOkResponse({ type: SupplierResponseDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return toResponse(
      SupplierResponseDto,
      await this.suppliersService.findOne(id),
    );
  }

  @Patch(':id')
  @ApiOkResponse({ type: SupplierResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSupplierDto: UpdateSupplierDto,
  ) {
    return toResponse(
      SupplierResponseDto,
      await this.suppliersService.update(id, updateSupplierDto),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.suppliersService.remove(id);
  }
}
