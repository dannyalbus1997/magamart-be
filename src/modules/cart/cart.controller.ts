import {
  Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Cart')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Get the current user\'s cart' })
  async getCart(@Req() req: any) {
    const cart = await this.cartService.getCart(req.user.id ?? req.user._id.toString());
    return { message: 'Cart fetched', data: cart };
  }

  @Post()
  @ApiOperation({ summary: 'Add an item to the cart' })
  async addItem(@Req() req: any, @Body() dto: AddToCartDto) {
    const cart = await this.cartService.addItem(req.user.id ?? req.user._id.toString(), dto);
    return { message: 'Item added to cart', data: cart };
  }

  @Put(':productId')
  @ApiOperation({ summary: 'Update quantity of a cart item' })
  async updateItem(
    @Req() req: any,
    @Param('productId') productId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    const cart = await this.cartService.updateItem(
      req.user.id ?? req.user._id.toString(),
      productId,
      dto,
    );
    return { message: 'Cart item updated', data: cart };
  }

  @Delete(':productId')
  @ApiOperation({ summary: 'Remove an item from the cart' })
  async removeItem(@Req() req: any, @Param('productId') productId: string) {
    const cart = await this.cartService.removeItem(
      req.user.id ?? req.user._id.toString(),
      productId,
    );
    return { message: 'Item removed from cart', data: cart };
  }

  @Delete()
  @ApiOperation({ summary: 'Clear the cart' })
  async clearCart(@Req() req: any) {
    const cart = await this.cartService.clearCart(req.user.id ?? req.user._id.toString());
    return { message: 'Cart cleared', data: cart };
  }
}
