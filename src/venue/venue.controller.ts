import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { VenueResponseDto } from './dto/venue-response.dto';
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
import { CreateVenueDto } from './dto/create-venue.dto';
import { QueryVenueDto } from './dto/query-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { VenueService } from './venue.service';

@ApiTags('venues')
@Controller('venues')
export class VenueController {
  constructor(private readonly venueService: VenueService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: VenueResponseDto })
  create(@Body() dto: CreateVenueDto) {
    return this.venueService.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: VenueResponseDto, isArray: true })
  findAll(@Query() query: QueryVenueDto) {
    return this.venueService.findAll(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: VenueResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.venueService.findOne(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: VenueResponseDto })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVenueDto) {
    return this.venueService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.venueService.remove(id);
  }
}
