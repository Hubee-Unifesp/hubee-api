import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { CreateDespesaDto } from './dto/create-despesa.dto';
import { UpdateDespesaDto } from './dto/update-despesa.dto';
import { DespesasController } from './despesas.controller';
import { DespesasService } from './despesas.service';

const EVENT_ID = 'event-1';

describe('DespesasController', () => {
  let controller: DespesasController;
  let service: {
    findAll: jest.Mock<DespesasService['findAll']>;
    findOne: jest.Mock<DespesasService['findOne']>;
    create: jest.Mock<DespesasService['create']>;
    update: jest.Mock<DespesasService['update']>;
    remove: jest.Mock<DespesasService['remove']>;
  };

  beforeEach(async () => {
    service = {
      findAll: jest.fn<DespesasService['findAll']>(),
      findOne: jest.fn<DespesasService['findOne']>(),
      create: jest.fn<DespesasService['create']>(),
      update: jest.fn<DespesasService['update']>(),
      remove: jest.fn<DespesasService['remove']>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DespesasController],
      providers: [{ provide: DespesasService, useValue: service }],
    }).compile();

    controller = module.get(DespesasController);
  });

  it('POST /eventos/:eventId/despesas delega para despesasService.create()', async () => {
    const dto: CreateDespesaDto = {
      fornecedorId: 'fornecedor-1',
      description: 'Aluguel de som e luz',
      amount: 1500,
      costType: 'infraestrutura',
      dueDate: new Date('2026-10-01T00:00:00Z'),
    };
    const created = { id: 'despesa-1', eventId: EVENT_ID, ...dto } as never;
    service.create.mockResolvedValue(created);

    const result = await controller.create(EVENT_ID, dto);

    expect(service.create).toHaveBeenCalledWith(EVENT_ID, dto);
    expect(result).toEqual(created);
  });

  it('GET /eventos/:eventId/despesas delega para despesasService.findAll() com os filtros da query', async () => {
    const list = [{ id: 'despesa-1' }] as never;
    service.findAll.mockResolvedValue(list);

    const result = await controller.findAll(EVENT_ID, {
      paymentStatus: 'pendente',
    });

    expect(service.findAll).toHaveBeenCalledWith(EVENT_ID, {
      paymentStatus: 'pendente',
    });
    expect(result).toEqual(list);
  });

  it('GET /eventos/:eventId/despesas/:id delega para despesasService.findOne()', async () => {
    const despesa = { id: 'despesa-1' } as never;
    service.findOne.mockResolvedValue(despesa);

    const result = await controller.findOne(EVENT_ID, 'despesa-1');

    expect(service.findOne).toHaveBeenCalledWith(EVENT_ID, 'despesa-1');
    expect(result).toEqual(despesa);
  });

  it('PATCH /eventos/:eventId/despesas/:id delega para despesasService.update()', async () => {
    const dto: UpdateDespesaDto = { paymentStatus: 'pago' };
    const updated = { id: 'despesa-1', ...dto } as never;
    service.update.mockResolvedValue(updated);

    const result = await controller.update(EVENT_ID, 'despesa-1', dto);

    expect(service.update).toHaveBeenCalledWith(EVENT_ID, 'despesa-1', dto);
    expect(result).toEqual(updated);
  });

  it('DELETE /eventos/:eventId/despesas/:id delega para despesasService.remove()', async () => {
    service.remove.mockResolvedValue(undefined);

    await controller.remove(EVENT_ID, 'despesa-1');

    expect(service.remove).toHaveBeenCalledWith(EVENT_ID, 'despesa-1');
  });
});
