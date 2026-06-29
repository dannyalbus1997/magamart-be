import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  /** Public — list active category names (used by FE dropdowns) */
  @Get('names')
  @ApiOperation({ summary: 'Get all active category names' })
  async getNames() {
    const names = await this.categoriesService.getNames();
    return { message: 'Categories fetched', data: names };
  }

  /** Public — list all active categories */
  @Get()
  @ApiOperation({ summary: 'Get all active categories' })
  async findAll() {
    const cats = await this.categoriesService.findAll();
    return { message: 'Categories fetched', data: cats };
  }

  /** Public — single category */
  @Get(':id')
  @ApiOperation({ summary: 'Get a category by ID' })
  async findOne(@Param('id') id: string) {
    const cat = await this.categoriesService.findOne(id);
    return { message: 'Category fetched', data: cat };
  }

  /** Admin — create */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a category (admin)' })
  async create(@Body() dto: CreateCategoryDto) {
    const cat = await this.categoriesService.create(dto);
    return { message: 'Category created', data: cat };
  }

  /** Admin — update */
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a category (admin)' })
  async update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    const cat = await this.categoriesService.update(id, dto);
    return { message: 'Category updated', data: cat };
  }

  /** Admin — delete */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a category (admin)' })
  async remove(@Param('id') id: string) {
    await this.categoriesService.remove(id);
    return { message: 'Category deleted', data: null };
  }
}
