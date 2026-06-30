import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument } from './schemas/order.schema';
import { Cart, CartDocument } from '../cart/schemas/cart.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { MailService } from '../mail/mail.service';

const SHIPPING_FEE = 99;
const FREE_SHIPPING_THRESHOLD = 999;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectModel(Order.name)   private orderModel:   Model<OrderDocument>,
    @InjectModel(Cart.name)    private cartModel:    Model<CartDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private readonly mailService: MailService,
  ) {}

  // ─── Format ─────────────────────────────────────────────────────────────────

  private async format(order: OrderDocument) {
    const populated = await this.orderModel
      .findById(order._id)
      .populate({ path: 'items.productId', model: 'Product' })
      .lean()
      .exec();

    if (!populated) return null;

    const items = (populated.items ?? []).map((item: any) => {
      const p = item.productId ?? {};
      return {
        productId: p._id?.toString() ?? item.productId?.toString(),
        product: {
          id:          p._id?.toString(),
          name:        p.name,
          image:       p.image,
          price:       p.price,
          category:    p.category,
          description: p.description,
          stock:       p.stock,
        },
        quantity: item.quantity,
        price:    item.price,
      };
    });

    return {
      id:              populated._id?.toString(),
      userId:          populated.userId?.toString(),
      items,
      subtotal:        populated.subtotal,
      shippingFee:     populated.shippingFee,
      total:           populated.total,
      status:          populated.status,
      shippingAddress: populated.shippingAddress,
      paymentStatus:   populated.paymentStatus,
      paymentIntent:   populated.paymentIntent,
      createdAt:       (populated as any).createdAt,
      updatedAt:       (populated as any).updatedAt,
    };
  }

  // ─── Create ──────────────────────────────────────────────────────────────────

  async createOrder(userId: string, dto: CreateOrderDto, reqUser?: any) {
    // 1. Get cart
    const cart = await this.cartModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .populate({ path: 'items.productId', model: 'Product' })
      .exec();

    if (!cart || !cart.items || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // 2. Validate stock and build order items
    const orderItems: Array<{ productId: Types.ObjectId; quantity: number; price: number }> = [];
    let subtotal = 0;

    for (const item of cart.items) {
      const product = await this.productModel.findById(item.productId).exec();
      if (!product) throw new BadRequestException(`Product not found`);
      if (product.stock < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for "${product.name}" (available: ${product.stock})`,
        );
      }
      orderItems.push({
        productId: new Types.ObjectId(product.id),
        quantity:  item.quantity,
        price:     product.price,
      });
      subtotal += product.price * item.quantity;
    }

    const shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
    const total       = subtotal + shippingFee;

    // 3. Create order
    const order = await this.orderModel.create({
      userId:          new Types.ObjectId(userId),
      items:           orderItems,
      subtotal,
      shippingFee,
      total,
      shippingAddress: dto.shippingAddress,
      paymentStatus:   'paid',
      paymentIntent:   dto.paymentIntent ?? null,
    });

    // 4. Decrement stock for each product
    await Promise.all(
      orderItems.map(item =>
        this.productModel.findByIdAndUpdate(item.productId, {
          $inc: { stock: -item.quantity },
        }),
      ),
    );

    // 5. Clear cart
    await this.cartModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { items: [] },
    );

    const formatted = await this.format(order);

    // 6. Send order confirmation email (non-blocking)
    if (reqUser?.email && formatted) {
      const userName = [reqUser.firstName, reqUser.lastName].filter(Boolean).join(' ') || reqUser.email;
      this.mailService
        .sendOrderConfirmation(reqUser.email, { userName, order: formatted })
        .catch((err) => this.logger.error('Order confirmation email failed', err));
    }

    return formatted;
  }

  // ─── Get user's orders ───────────────────────────────────────────────────────

  async getMyOrders(userId: string) {
    const orders = await this.orderModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();

    const formatted = await Promise.all(orders.map(o => this.format(o)));
    return { data: formatted, total: formatted.length };
  }

  // ─── Get single order ────────────────────────────────────────────────────────

  async getOrder(id: string, userId?: string) {
    const order = await this.orderModel.findById(id).exec();
    if (!order) throw new NotFoundException('Order not found');

    // Non-admin users can only see their own orders
    if (userId && order.userId.toString() !== userId) {
      throw new NotFoundException('Order not found');
    }

    return this.format(order);
  }

  // ─── Admin: get all orders ───────────────────────────────────────────────────

  async getAllOrders(query: QueryOrdersDto) {
    const { status, page = 1, limit = 20 } = query;
    const filter: any = {};
    if (status) filter.status = status;

    const skip  = (page - 1) * limit;
    const total = await this.orderModel.countDocuments(filter);
    const orders = await this.orderModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    const data = await Promise.all(orders.map(o => this.format(o)));
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── Admin: update status ────────────────────────────────────────────────────

  async updateStatus(id: string, dto: UpdateOrderStatusDto) {
    const order = await this.orderModel.findByIdAndUpdate(
      id,
      { status: dto.status },
      { new: true },
    ).exec();
    if (!order) throw new NotFoundException('Order not found');
    return this.format(order);
  }
}
