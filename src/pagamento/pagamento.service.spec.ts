import { jest } from '@jest/globals';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { pagamentos } from '../database/schema';
import { OrderService } from '../order/order.service';
import { CreatePagamentoDto } from './dto/create-pagamento.dto';
import { PagamentoRepository } from './pagamento.repository';
import { PagamentoService } from './pagamento.service';

type Pagamento = typeof pagamentos.$inferSelect;

const PEDIDO_ID = 'pedido-1';

function makePagamento(overrides: Partial<Pagamento> = {}): Pagamento {
  return {
    id: 'pagamento-1',
    orderId: PEDIDO_ID,
    metodoPagamento: 'pix',
    status: 'pendente',
    valorPago: 250,
    dataPagamento: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('PagamentoService', () => {
  let service: PagamentoService;
  let pagamentoRepository: {
    findByOrderId: jest.Mock<PagamentoRepository['findByOrderId']>;
    create: jest.Mock<PagamentoRepository['create']>;
    update: jest.Mock<PagamentoRepository['update']>;
  };
  let orderService: { findOne: jest.Mock<OrderService['findOne']> };

  beforeEach(async () => {
    pagamentoRepository = {
      findByOrderId: jest.fn<PagamentoRepository['findByOrderId']>(),
      create: jest.fn<PagamentoRepository['create']>(),
      update: jest.fn<PagamentoRepository['update']>(),
    };
    orderService = { findOne: jest.fn<OrderService['findOne']>() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PagamentoService,
        { provide: PagamentoRepository, useValue: pagamentoRepository },
        { provide: OrderService, useValue: orderService },
      ],
    }).compile();

    service = module.get(PagamentoService);

    orderService.findOne.mockResolvedValue({ id: PEDIDO_ID } as never);
  });

  describe('findOne()', () => {
    it('retorna o pagamento quando existe', async () => {
      const pagamento = makePagamento();
      pagamentoRepository.findByOrderId.mockResolvedValue(pagamento);

      await expect(service.findOne(PEDIDO_ID)).resolves.toEqual(pagamento);
      expect(orderService.findOne).toHaveBeenCalledWith(PEDIDO_ID);
    });

    it('lança NotFound quando o pedido não existe', async () => {
      orderService.findOne.mockRejectedValue(new NotFoundException());

      await expect(service.findOne(PEDIDO_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(pagamentoRepository.findByOrderId).not.toHaveBeenCalled();
    });

    it('lança NotFound quando o pagamento não existe para o pedido', async () => {
      pagamentoRepository.findByOrderId.mockResolvedValue(undefined);

      await expect(service.findOne(PEDIDO_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create()', () => {
    const dto: CreatePagamentoDto = {
      metodoPagamento: 'pix',
      valorPago: 250,
    };

    it('cria o pagamento quando o pedido existe e não tem pagamento', async () => {
      pagamentoRepository.findByOrderId.mockResolvedValue(undefined);
      const created = makePagamento();
      pagamentoRepository.create.mockResolvedValue(created);

      const result = await service.create(PEDIDO_ID, dto);

      expect(orderService.findOne).toHaveBeenCalledWith(PEDIDO_ID);
      expect(pagamentoRepository.create).toHaveBeenCalledWith({
        ...dto,
        orderId: PEDIDO_ID,
      });
      expect(result).toEqual(created);
    });

    it('lança 409 quando o pedido já tem pagamento registrado', async () => {
      pagamentoRepository.findByOrderId.mockResolvedValue(makePagamento());

      await expect(service.create(PEDIDO_ID, dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(pagamentoRepository.create).not.toHaveBeenCalled();
    });

    it('lança NotFound quando o pedido não existe', async () => {
      orderService.findOne.mockRejectedValue(new NotFoundException());

      await expect(service.create(PEDIDO_ID, dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(pagamentoRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('update()', () => {
    it('atualiza o status do pagamento existente', async () => {
      pagamentoRepository.findByOrderId.mockResolvedValue(makePagamento());
      const updated = makePagamento({ status: 'confirmado' });
      pagamentoRepository.update.mockResolvedValue(updated);

      const result = await service.update(PEDIDO_ID, {
        status: 'confirmado',
      });

      expect(pagamentoRepository.update).toHaveBeenCalledWith('pagamento-1', {
        status: 'confirmado',
      });
      expect(result).toEqual(updated);
    });

    it('lança NotFound quando o pagamento não existe', async () => {
      pagamentoRepository.findByOrderId.mockResolvedValue(undefined);

      await expect(
        service.update(PEDIDO_ID, { status: 'confirmado' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(pagamentoRepository.update).not.toHaveBeenCalled();
    });
  });
});
