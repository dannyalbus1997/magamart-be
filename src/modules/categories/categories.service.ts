import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category, CategoryDocument } from './schemas/category.schema';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
  ) {}

  async findAll(): Promise<CategoryDocument[]> {
    return this.categoryModel.find({ isActive: true }).sort({ name: 1 }).exec();
  }

  async findAllAdmin(): Promise<CategoryDocument[]> {
    return this.categoryModel.find().sort({ name: 1 }).exec();
  }

  async findOne(id: string): Promise<CategoryDocument> {
    const cat = await this.categoryModel.findById(id).exec();
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
  }

  async create(dto: CreateCategoryDto): Promise<CategoryDocument> {
    const exists = await this.categoryModel.findOne({ name: new RegExp(`^${dto.name}$`, 'i') });
    if (exists) throw new ConflictException('Category already exists');
    return this.categoryModel.create(dto);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryDocument> {
    const cat = await this.categoryModel.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
  }

  async remove(id: string): Promise<void> {
    const cat = await this.categoryModel.findByIdAndDelete(id).exec();
    if (!cat) throw new NotFoundException('Category not found');
  }

  async getNames(): Promise<string[]> {
    const cats = await this.categoryModel.find({ isActive: true }).sort({ name: 1 }).select('name').exec();
    return cats.map((c) => c.name);
  }
}
