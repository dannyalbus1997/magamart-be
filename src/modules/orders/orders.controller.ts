import {
  Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  private uid(req: any): string {
    return req.user.id ?? req.user._id.toString();
  }

  /** GET /orders/my — authenticated user's own orders */
  @Get('my')
  @ApiOperation({ summary: "Get the current user's orders" })
  async getMyOrders(@Req() req: any) {
    const result = await this.ordersService.getMyOrders(this.uid(req));
    return { message: 'Orders fetched', ...result };
  }

  /** GET /orders — admin: all orders with optional status filter + pagination */
  @Get()
  @ApiOperation({ summary: 'Get all orders (admin)' })
  async getAllOrders(@Query() query: QueryOrdersDto) {
    const result = await this.ordersService.getAllOrders(query);
    return { message: 'Orders fetched', ...result };
  }

  /** GET /orders/:id — get single order (user sees own; admin sees any) */
  @Get(':id')
  @ApiOperation({ summary: 'Get a single order by ID' })
  async getOrder(@Param('id') id: string, @Req() req: any) {
    const isAdmin = req.user?.role === 'admin';
    const order = await this.ordersService.getOrder(id, isAdmin ? undefined : this.uid(req));
    return { message: 'Order fetched', data: order };
  }

  /** POST /orders — create order from cart */
  @Post()
  @ApiOperation({ summary: 'Place an order from the current cart' })
  async createOrder(@Req() req: any, @Body() dto: CreateOrderDto) {
    const order = await this.ordersService.createOrder(this.uid(req), dto);
    return { message: 'Order placed successfully', data: order };
  }

  /** PUT /orders/:id/status — admin: update order status */
  @Put(':id/status')
  @ApiOperation({ summary: 'Update order status (admin)' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    const order = await this.ordersService.updateStatus(id, dto);
    return { message: 'Order status updated', data: order };
  }
}
