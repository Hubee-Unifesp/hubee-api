import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { SupplierResponseDto } from './dto/supplier-response.dto';
import { SupplierReviewResponseDto } from './dto/supplier-review-response.dto';
import { CreateSupplierReviewDto } from './dto/create-supplier-review.dto';
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
  Query,
  Res,
} from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { QuerySupplierDto } from './dto/query-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { toResponse } from '../common/serialization/to-response';
import { OrganizerOnly } from '../auth/decorators/organizer-only.decorator';
import {
  type AuthenticatedUser,
  CurrentUser,
} from '../auth/decorators/current-user.decorator';

@ApiTags('suppliers')
@OrganizerOnly()
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
  async findAll(@Query() query?: QuerySupplierDto) {
    return toResponse(
      SupplierResponseDto,
      await this.suppliersService.findAll(query),
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

  @Post(':id/reviews')
  @ApiCreatedResponse({
    type: SupplierReviewResponseDto,
    description: 'Primeira avaliação do organizador para o fornecedor.',
  })
  @ApiOkResponse({
    type: SupplierReviewResponseDto,
    description: 'Avaliação anterior do organizador atualizada.',
  })
  @ApiBadRequestResponse({
    description: 'Nota fora do intervalo 1 a 5 ou comentário inválido.',
  })
  @ApiNotFoundResponse({ description: 'Fornecedor não encontrado.' })
  async saveReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSupplierReviewDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { review, created } = await this.suppliersService.saveReview(
      id,
      user.id,
      dto,
    );
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return toResponse(SupplierReviewResponseDto, review);
  }

  @Get(':id/reviews')
  @ApiOkResponse({ type: SupplierReviewResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'Fornecedor não encontrado.' })
  async findReviews(@Param('id', ParseUUIDPipe) id: string) {
    return toResponse(
      SupplierReviewResponseDto,
      await this.suppliersService.findReviews(id),
    );
  }
}
