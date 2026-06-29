import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(Order.name)   private orderModel:   Model<OrderDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(User.name)    private userModel:    Model<UserDocument>,
  ) {}

  async getSummary() {
    const [
      totalOrders,
      totalProducts,
      totalCustomers,
      salesAgg,
      statusAgg,
      salesByDayAgg,
      topProductsAgg,
    ] = await Promise.all([
      // Total orders count
      this.orderModel.countDocuments(),

      // Total products count
      this.productModel.countDocuments(),

      // Total customers (non-admin users)
      this.userModel.countDocuments({ role: 'user' }),

      // Total sales (sum of all non-cancelled orders)
      this.orderModel.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),

      // Orders grouped by status
      this.orderModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      // Sales by day — last 7 days
      this.orderModel.aggregate([
        {
          $match: {
            status: { $ne: 'cancelled' },
            createdAt: { $gte: this.daysAgo(6) },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            sales:  { $sum: '$total' },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Top 5 products by units sold
      this.orderModel.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        { $unwind: '$items' },
        {
          $group: {
            _id:       '$items.productId',
            totalSold: { $sum: '$items.quantity' },
            revenue:   { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          },
        },
        { $sort: { totalSold: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from:         'products',
            localField:   '_id',
            foreignField: '_id',
            as:           'productData',
          },
        },
        { $unwind: { path: '$productData', preserveNullAndEmptyArrays: false } },
      ]),
    ]);

    // --- Shape the results ---

    const totalSales = salesAgg[0]?.total ?? 0;

    // Orders by status
    const ALL_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    const ordersByStatus: Record<string, number> = {};
    for (const s of ALL_STATUSES) ordersByStatus[s] = 0;
    for (const row of statusAgg) ordersByStatus[row._id] = row.count;

    // Sales by day — fill missing days with 0
    const dayMap: Record<string, { sales: number; orders: number }> = {};
    for (const row of salesByDayAgg) dayMap[row._id] = { sales: row.sales, orders: row.orders };

    const salesByDay = Array.from({ length: 7 }, (_, i) => {
      const d = this.daysAgo(6 - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-US', { weekday: 'short' });
      return {
        date:   label,
        sales:  dayMap[key]?.sales  ?? 0,
        orders: dayMap[key]?.orders ?? 0,
      };
    });

    // Top products
    const topProducts = topProductsAgg.map((row) => {
      const p = row.productData;
      return {
        totalSold: row.totalSold,
        revenue:   row.revenue,
        product: {
          id:          p._id?.toString(),
          name:        p.name,
          description: p.description,
          price:       p.price,
          image:       p.image,
          category:    p.category,
          stock:       p.stock,
          createdAt:   p.createdAt,
          updatedAt:   p.updatedAt,
        },
      };
    });

    return {
      totalSales,
      totalOrders,
      totalProducts,
      totalCustomers,
      ordersByStatus,
      salesByDay,
      topProducts,
    };
  }

  private daysAgo(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(0, 0, 0, 0);
    return d;
  }
}
