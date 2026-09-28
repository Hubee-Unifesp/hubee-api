import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OrganizationResponseDto } from './dto/organization-response.dto';
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
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { QueryOrganizationDto } from './dto/query-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationService } from './organization.service';

@ApiTags('organizations')
@Controller('organizations')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: OrganizationResponseDto })
  create(@Body() dto: CreateOrganizationDto) {
    return this.organizationService.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: OrganizationResponseDto, isArray: true })
  findAll(@Query() query: QueryOrganizationDto) {
    return this.organizationService.findAll(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: OrganizationResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationService.findOne(id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: OrganizationResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.organizationService.remove(id);
  }
}
