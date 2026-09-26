import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { CreatePagamentoDto } from './dto/create-pagamento.dto';
import { UpdatePagamentoDto } from './dto/update-pagamento.dto';
import { PagamentoController } from './pagamento.controller';
import { PagamentoService } from './pagamento.service';

const PEDIDO_ID = 'pedido-1';

describe('PagamentoController', () => {
  let controller: PagamentoController;
  let service: {
    findOne: jest.Mock<PagamentoService['findOne']>;
    create: jest.Mock<PagamentoService['create']>;
    update: jest.Mock<PagamentoService['update']>;
  };

  beforeEach(async () => {
    service = {
      findOne: jest.fn<PagamentoService['findOne']>(),
      create: jest.fn<PagamentoService['create']>(),
      update: jest.fn<PagamentoService['update']>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PagamentoController],
      providers: [{ provide: PagamentoService, useValue: service }],
    }).compile();

    controller = module.get(PagamentoController);
  });

  it('POST /pedidos/:pedidoId/pagamento delega para pagamentoService.create()', async () => {
    const dto: CreatePagamentoDto = {
      metodoPagamento: 'pix',
      valorPago: 250,
    };
    const created = { id: 'pagamento-1', orderId: PEDIDO_ID, ...dto } as never;
    service.create.mockResolvedValue(created);

    const result = await controller.create(PEDIDO_ID, dto);

    expect(service.create).toHaveBeenCalledWith(PEDIDO_ID, dto);
    expect(result).toEqual(created);
  });

  it('GET /pedidos/:pedidoId/pagamento delega para pagamentoService.findOne()', async () => {
    const pagamento = { id: 'pagamento-1' } as never;
    service.findOne.mockResolvedValue(pagamento);

    const result = await controller.findOne(PEDIDO_ID);

    expect(service.findOne).toHaveBeenCalledWith(PEDIDO_ID);
    expect(result).toEqual(pagamento);
  });

  it('PATCH /pedidos/:pedidoId/pagamento delega para pagamentoService.update()', async () => {
    const dto: UpdatePagamentoDto = { status: 'confirmado' };
    const updated = { id: 'pagamento-1', ...dto } as never;
    service.update.mockResolvedValue(updated);

    const result = await controller.update(PEDIDO_ID, dto);

    expect(service.update).toHaveBeenCalledWith(PEDIDO_ID, dto);
    expect(result).toEqual(updated);
  });
});
