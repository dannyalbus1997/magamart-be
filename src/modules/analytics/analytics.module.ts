import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema }     from '../orders/schemas/order.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { User, UserSchema }       from '../users/schemas/user.schema';
import { AnalyticsController }    from './analytics.controller';
import { AnalyticsService }       from './analytics.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name,   schema: OrderSchema   },
      { name: Product.name, schema: ProductSchema },
      { name: User.name,    schema: UserSchema    },
    ]),
  ],
  controllers: [AnalyticsController],
  providers:   [AnalyticsService],
})
export class AnalyticsModule {}
