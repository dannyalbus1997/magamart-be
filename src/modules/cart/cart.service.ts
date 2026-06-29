import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cart, CartDocument } from './schemas/cart.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name)   private cartModel:    Model<CartDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
  ) {}

  // ─── helpers ────────────────────────────────────────────────────────────────

  /** Find or create the user's cart */
  private async findOrCreate(userId: string): Promise<CartDocument> {
    let cart = await this.cartModel.findOne({ userId: new Types.ObjectId(userId) });
    if (!cart) {
      cart = await this.cartModel.create({ userId: new Types.ObjectId(userId), items: [] });
    }
    return cart;
  }

  /** Populate items and compute total, returning a plain serialisable object */
  private async format(cart: CartDocument) {
    const populated = await this.cartModel
      .findById(cart._id)
      .populate({ path: 'items.productId', model: 'Product' })
      .lean()
      .exec();

    if (!populated) return { id: cart.id, userId: cart.userId.toString(), items: [], total: 0 };

    const items = (populated.items ?? []).map((item: any) => {
      const product = item.productId ?? {};
      return {
        productId: product._id?.toString() ?? item.productId?.toString(),
        product:   { id: product._id?.toString(), ...product, _id: undefined, __v: undefined },
        quantity:  item.quantity,
      };
    });

    const total = items.reduce(
      (sum: number, i: any) => sum + (i.product?.price ?? 0) * i.quantity,
      0,
    );

    return {
      id:     populated._id?.toString(),
      userId: populated.userId?.toString(),
      items,
      total,
    };
  }

  // ─── public API ─────────────────────────────────────────────────────────────

  async getCart(userId: string) {
    const cart = await this.findOrCreate(userId);
    return this.format(cart);
  }

  async addItem(userId: string, dto: AddToCartDto) {
    const product = await this.productModel.findById(dto.productId);
    if (!product) throw new NotFoundException('Product not found');
    if (product.stock === 0) throw new BadRequestException('Product is out of stock');

    const cart = await this.findOrCreate(userId);
    const qty  = dto.quantity ?? 1;

    const existing = cart.items.find(
      (i) => i.productId.toString() === dto.productId,
    );

    if (existing) {
      existing.quantity = Math.min(existing.quantity + qty, product.stock);
    } else {
      cart.items.push({ productId: new Types.ObjectId(dto.productId), quantity: qty } as any);
    }

    await cart.save();
    return this.format(cart);
  }

  async updateItem(userId: string, productId: string, dto: UpdateCartItemDto) {
    const cart = await this.findOrCreate(userId);
    const item = cart.items.find((i) => i.productId.toString() === productId);
    if (!item) throw new NotFoundException('Item not in cart');

    const product = await this.productModel.findById(productId);
    if (!product) throw new NotFoundException('Product not found');

    item.quantity = Math.min(dto.quantity, product.stock || dto.quantity);
    await cart.save();
    return this.format(cart);
  }

  async removeItem(userId: string, productId: string) {
    const cart = await this.findOrCreate(userId);
    const before = cart.items.length;
    cart.items = cart.items.filter((i) => i.productId.toString() !== productId) as any;
    if (cart.items.length === before) throw new NotFoundException('Item not in cart');
    await cart.save();
    return this.format(cart);
  }

  async clearCart(userId: string) {
    const cart = await this.findOrCreate(userId);
    cart.items = [] as any;
    await cart.save();
    return this.format(cart);
  }
}
