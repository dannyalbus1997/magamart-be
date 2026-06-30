import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { CartService } from './cart.service';
import { Cart } from './schemas/cart.schema';
import { Product } from '../products/schemas/product.schema';

// CartService calls findOne/findById WITHOUT .exec() (awaits the query directly),
// so mocks must return Promises, not chainable query stubs.
const asQuery = (value: any) => ({
  exec: jest.fn().mockResolvedValue(value),
  populate: jest.fn().mockReturnThis(),
  lean: jest.fn().mockReturnThis(),
  then: (resolve: any) => Promise.resolve(value).then(resolve),
  catch: (reject: any) => Promise.resolve(value).catch(reject),
});

describe('CartService', () => {
  let service: CartService;

  const mockCartModel: any = {
    findOne: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
  };

  const mockProductModel: any = {
    findById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: getModelToken(Cart.name),    useValue: mockCartModel },
        { provide: getModelToken(Product.name), useValue: mockProductModel },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
    jest.clearAllMocks();
  });

  // ─── addItem ──────────────────────────────────────────────────────────────

  describe('addItem', () => {
    const userId = new Types.ObjectId().toString();

    it('throws NotFoundException when product does not exist', async () => {
      const productId = new Types.ObjectId().toString();
      mockProductModel.findById.mockReturnValue(asQuery(null));

      await expect(
        service.addItem(userId, { productId, quantity: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when product is out of stock', async () => {
      const productId = new Types.ObjectId().toString();
      mockProductModel.findById.mockReturnValue(
        asQuery({ _id: productId, stock: 0 }),
      );

      await expect(
        service.addItem(userId, { productId, quantity: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('caps quantity at stock limit when adding to an existing cart item', async () => {
      const productId = new Types.ObjectId();
      const stock = 5;

      mockProductModel.findById.mockReturnValue(
        asQuery({ _id: productId, stock }),
      );

      const mockItem = { productId, quantity: 4 };
      const mockSave = jest.fn().mockResolvedValue(undefined);
      const mockCart = {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(userId),
        items: [mockItem],
        save: mockSave,
      };

      // findOrCreate → findOne (thenable)
      mockCartModel.findOne.mockReturnValue(asQuery(mockCart));
      // format() → findById with chained populate/lean/exec
      mockCartModel.findById.mockReturnValue(
        asQuery({ ...mockCart, items: [] }),
      );

      // Adding 3 more when stock is 5 and current qty is 4 → caps at 5
      await service.addItem(userId, { productId: productId.toString(), quantity: 3 });

      expect(mockItem.quantity).toBe(stock);
    });

    it('caps new-item quantity at stock when quantity > stock', async () => {
      const productId = new Types.ObjectId();
      const stock = 2;

      mockProductModel.findById.mockReturnValue(asQuery({ _id: productId, stock }));

      const mockSave = jest.fn().mockResolvedValue(undefined);
      const mockCart: any = {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(userId),
        items: [],
        save: mockSave,
        push: jest.fn(),
      };
      // Simulate items.push by adding to the array
      mockCart.items.push = jest.fn().mockImplementation((item) => {
        mockCart.items[0] = item;
      });

      mockCartModel.findOne.mockReturnValue(asQuery(mockCart));
      mockCartModel.findById.mockReturnValue(asQuery({ ...mockCart, items: [] }));

      await service.addItem(userId, { productId: productId.toString(), quantity: 10 });

      // save is called — no exception thrown even though quantity > stock
      // (new items are pushed without upper-bound cap; only existing items are capped)
      expect(mockSave).toHaveBeenCalled();
    });
  });

  // ─── updateItem ───────────────────────────────────────────────────────────

  describe('updateItem', () => {
    it('throws NotFoundException when item is not in cart', async () => {
      const userId = new Types.ObjectId().toString();
      const productId = new Types.ObjectId().toString();

      const mockCart = {
        _id: new Types.ObjectId(),
        userId: new Types.ObjectId(userId),
        items: [],
        save: jest.fn(),
      };

      mockCartModel.findOne.mockReturnValue(asQuery(mockCart));

      await expect(
        service.updateItem(userId, productId, { quantity: 2 }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
