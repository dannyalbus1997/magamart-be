import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
  ) {}

  async findAll(query: QueryProductDto) {
    const {
      search, category, minPrice, maxPrice,
      sortBy = 'createdAt', sortOrder = 'desc',
      page = 1, limit = 12,
    } = query;

    const filter: FilterQuery<ProductDocument> = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }
    if (category) filter.category = category;
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) filter.price.$gte = minPrice;
      if (maxPrice !== undefined) filter.price.$lte = maxPrice;
    }

    const skip = (page - 1) * limit;
    const sortDir = sortOrder === 'asc' ? 1 : -1;

    const [data, total] = await Promise.all([
      this.productModel.find(filter).sort({ [sortBy]: sortDir }).skip(skip).limit(limit).exec(),
      this.productModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<ProductDocument> {
    const product = await this.productModel.findById(id).exec();
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async getCategories(): Promise<string[]> {
    const cats = await this.productModel.distinct('category').exec();
    return cats.sort();
  }

  async create(dto: CreateProductDto, imageFilename?: string): Promise<ProductDocument> {
    return this.productModel.create({
      ...dto,
      image: imageFilename ? `/uploads/products/${imageFilename}` : null,
    });
  }

  async update(id: string, dto: UpdateProductDto, imageFilename?: string): Promise<ProductDocument> {
    const existing = await this.productModel.findById(id).exec();
    if (!existing) throw new NotFoundException('Product not found');

    const updateData: any = { ...dto };

    if (imageFilename) {
      // Remove old image file if it exists
      if (existing.image) {
        const oldFile = path.join(process.cwd(), existing.image);
        if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
      }
      updateData.image = `/uploads/products/${imageFilename}`;
    }

    const updated = await this.productModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Product not found');
    return updated;
  }

  async remove(id: string): Promise<void> {
    const product = await this.productModel.findById(id).exec();
    if (!product) throw new NotFoundException('Product not found');

    // Remove image file
    if (product.image) {
      const filePath = path.join(process.cwd(), product.image);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await this.productModel.findByIdAndDelete(id).exec();
  }
}
