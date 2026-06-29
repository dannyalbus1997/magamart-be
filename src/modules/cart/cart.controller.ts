import {
  Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';

const EMPTY_CART = { id: null, userId: null, items: [], total: 0 };
const LOGIN_REQUIRED = { message: 'Please sign in to manage your cart', data: EMPTY_CART };

@ApiTags('Cart')
@ApiBearerAuth()
@UseGuards(OptionalJwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  private userId(req: any): string | null {
    return req.user ? (req.user.id ?? req.user._id?.toString()) : null;
  }

  @Get()
  @ApiOperation({ summary: "Get the current user's cart" })
  async getCart(@Req() req: any) {
    const uid = this.userId(req);
    if (!uid) return { message: 'Cart fetched', data: EMPTY_CART };
    const cart = await this.cartService.getCart(uid);
    return { message: 'Cart fetched', data: cart };
  }

  @Post()
  @ApiOperation({ summary: 'Add an item to the cart' })
  async addItem(@Req() req: any, @Body() dto: AddToCartDto) {
    const uid = this.userId(req);
    if (!uid) return LOGIN_REQUIRED;
    const cart = await this.cartService.addItem(uid, dto);
    return { message: 'Item added to cart', data: cart };
  }

  @Put(':productId')
  @ApiOperation({ summary: 'Update quantity of a cart item' })
  async updateItem(
    @Req() req: any,
    @Param('productId') productId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    const uid = this.userId(req);
    if (!uid) return LOGIN_REQUIRED;
    const cart = await this.cartService.updateItem(uid, productId, dto);
    return { message: 'Cart item updated', data: cart };
  }

  @Delete(':productId')
  @ApiOperation({ summary: 'Remove an item from the cart' })
  async removeItem(@Req() req: any, @Param('productId') productId: string) {
    const uid = this.userId(req);
    if (!uid) return LOGIN_REQUIRED;
    const cart = await this.cartService.removeItem(uid, productId);
    return { message: 'Item removed from cart', data: cart };
  }

  @Delete()
  @ApiOperation({ summary: 'Clear the cart' })
  async clearCart(@Req() req: any) {
    const uid = this.userId(req);
    if (!uid) return LOGIN_REQUIRED;
    const cart = await this.cartService.clearCart(uid);
    return { message: 'Cart cleared', data: cart };
  }
}
