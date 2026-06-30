import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { OrdersService } from './orders.service';
import { Order } from './schemas/order.schema';
import { Cart } from '../cart/schemas/cart.schema';
import { Product } from '../products/schemas/product.schema';
import { MailService } from '../mail/mail.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const chainable = (value: any) => ({
  exec: jest.fn().mockResolvedValue(value),
  populate: jest.fn().mockReturnThis(),
  lean: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
});

const objectId = () => new Types.ObjectId();

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('OrdersService', () => {
  let service: OrdersService;

  const mockOrderModel: any = {
    create: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    countDocuments: jest.fn(),
  };

  const mockCartModel: any = {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  };

  const mockProductModel: any = {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  };

  const mockMailService = { sendOrderConfirmation: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getModelToken(Order.name),   useValue: mockOrderModel },
        { provide: getModelToken(Cart.name),    useValue: mockCartModel },
        { provide: getModelToken(Product.name), useValue: mockProductModel },
        { provide: MailService,                 useValue: mockMailService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    jest.clearAllMocks();
  });

  // ─── createOrder ──────────────────────────────────────────────────────────

  describe('createOrder', () => {
    const userId = objectId().toString();
    const shippingAddress = {
      name: 'Test User', address: '1 Test St', city: 'City',
      state: 'ST', zip: '12345', country: 'US',
    };

    it('throws BadRequestException when cart is empty', async () => {
      mockCartModel.findOne.mockReturnValue(chainable({ items: [] }));

      await expect(
        service.createOrder(userId, { shippingAddress }, undefined),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when product has insufficient stock', async () => {
      const productId = objectId();
      const mockCart = {
        items: [{ productId, quantity: 5 }],
      };
      mockCartModel.findOne.mockReturnValue(chainable(mockCart));
      mockProductModel.findById.mockReturnValue(
        chainable({ _id: productId, name: 'Widget', price: 10, stock: 2 }),
      );

      await expect(
        service.createOrder(userId, { shippingAddress }, undefined),
      ).rejects.toThrow(BadRequestException);
    });

    it('uses product price from DB, not from any client input (price snapshot)', async () => {
      const productId = objectId();
      const dbPrice = 99.99;

      const mockCart = { items: [{ productId, quantity: 1 }] };
      mockCartModel.findOne.mockReturnValue(chainable(mockCart));
      mockCartModel.findOneAndUpdate.mockReturnValue(chainable(null));

      mockProductModel.findById.mockReturnValue(
        chainable({ _id: productId, id: productId.toString(), name: 'Widget', price: dbPrice, stock: 10 }),
      );
      mockProductModel.findByIdAndUpdate.mockReturnValue(chainable(null));

      const savedOrder = { _id: objectId(), items: [], subtotal: dbPrice, shippingFee: 99, total: dbPrice + 99, status: 'pending', shippingAddress, paymentStatus: 'paid', paymentIntent: null };
      mockOrderModel.create.mockResolvedValue(savedOrder);

      // format() calls findById — return populated order
      mockOrderModel.findById.mockReturnValue(chainable({ ...savedOrder, items: [{ productId: { _id: productId, name: 'Widget', price: dbPrice }, quantity: 1, price: dbPrice }] }));

      await service.createOrder(userId, { shippingAddress }, undefined);

      // Verify create was called with the DB price, not any other value
      const createCall = mockOrderModel.create.mock.calls[0][0];
      expect(createCall.items[0].price).toBe(dbPrice);
    });

    it('decrements stock for every ordered product', async () => {
      const productId = objectId();
      const mockCart = { items: [{ productId, quantity: 3 }] };
      mockCartModel.findOne.mockReturnValue(chainable(mockCart));
      mockCartModel.findOneAndUpdate.mockReturnValue(chainable(null));

      mockProductModel.findById.mockReturnValue(
        chainable({ _id: productId, id: productId.toString(), name: 'Widget', price: 20, stock: 10 }),
      );
      mockProductModel.findByIdAndUpdate.mockReturnValue(chainable(null));

      const savedOrder = { _id: objectId(), items: [], subtotal: 60, shippingFee: 99, total: 159, status: 'pending', shippingAddress, paymentStatus: 'paid', paymentIntent: null };
      mockOrderModel.create.mockResolvedValue(savedOrder);
      mockOrderModel.findById.mockReturnValue(chainable({ ...savedOrder, items: [] }));

      await service.createOrder(userId, { shippingAddress }, undefined);

      expect(mockProductModel.findByIdAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { $inc: { stock: -3 } },
      );
    });
  });

  // ─── updateStatus ─────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('throws NotFoundException when order does not exist', async () => {
      mockOrderModel.findById.mockReturnValue(chainable(null));

      await expect(service.updateStatus('nonexistent', { status: 'processing' }))
        .rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for an invalid status transition', async () => {
      const orderId = objectId().toString();
      mockOrderModel.findById.mockReturnValue(
        chainable({ _id: orderId, status: 'delivered', save: jest.fn() }),
      );

      await expect(service.updateStatus(orderId, { status: 'cancelled' }))
        .rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when trying to move backwards (shipped -> pending)', async () => {
      const orderId = objectId().toString();
      mockOrderModel.findById.mockReturnValue(
        chainable({ _id: orderId, status: 'shipped', save: jest.fn() }),
      );

      await expect(service.updateStatus(orderId, { status: 'pending' }))
        .rejects.toThrow(BadRequestException);
    });

    it('accepts valid transition from pending to processing', async () => {
      const orderId = objectId();
      const mockSave = jest.fn().mockResolvedValue(undefined);
      const mockOrder = { _id: orderId, status: 'pending', save: mockSave };

      mockOrderModel.findById
        .mockReturnValueOnce(chainable(mockOrder))   // first call in updateStatus
        .mockReturnValue(chainable({ ...mockOrder, status: 'processing', items: [] })); // format() call

      await service.updateStatus(orderId.toString(), { status: 'processing' });

      expect(mockSave).toHaveBeenCalled();
      expect(mockOrder.status).toBe('processing');
    });
  });
});
