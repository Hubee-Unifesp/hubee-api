import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { SupplierResponseDto } from './dto/supplier-response.dto';

/** Linha completa do banco, incluindo o campo interno `deletedAt`. */
const row = {
  id: 'supplier-1',
  companyName: 'Som & Luz',
  cnpjCpf: '12345678000190',
  phone: null,
  email: 'contato@someluz.com',
  category: 'infraestrutura',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  deletedAt: null,
};
const { deletedAt: _deletedAt, ...publicSupplier } = row;

describe('SuppliersController', () => {
  let controller: SuppliersController;
  let service: {
    create: jest.Mock<SuppliersService['create']>;
    findAll: jest.Mock<SuppliersService['findAll']>;
    findOne: jest.Mock<SuppliersService['findOne']>;
    update: jest.Mock<SuppliersService['update']>;
    remove: jest.Mock<SuppliersService['remove']>;
  };

  beforeEach(async () => {
    service = {
      create: jest.fn<SuppliersService['create']>(),
      findAll: jest.fn<SuppliersService['findAll']>(),
      findOne: jest.fn<SuppliersService['findOne']>(),
      update: jest.fn<SuppliersService['update']>(),
      remove: jest.fn<SuppliersService['remove']>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SuppliersController],
      providers: [{ provide: SuppliersService, useValue: service }],
    }).compile();

    controller = module.get(SuppliersController);
  });

  it('POST /suppliers retorna o SupplierResponseDto sem deletedAt', async () => {
    const dto = { companyName: 'Som & Luz', cnpjCpf: '12345678000190' };
    service.create.mockResolvedValue(row as never);

    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toBeInstanceOf(SupplierResponseDto);
    expect(result).toEqual(publicSupplier);
  });

  it('GET /suppliers retorna a lista de SupplierResponseDto', async () => {
    service.findAll.mockResolvedValue([row] as never);

    const result = await controller.findAll();

    expect(result[0]).toBeInstanceOf(SupplierResponseDto);
    expect(result).toEqual([publicSupplier]);
  });

  it('GET /suppliers/:id retorna o SupplierResponseDto sem deletedAt', async () => {
    service.findOne.mockResolvedValue(row as never);

    const result = await controller.findOne('supplier-1');

    expect(service.findOne).toHaveBeenCalledWith('supplier-1');
    expect(result).toBeInstanceOf(SupplierResponseDto);
    expect(result).toEqual(publicSupplier);
  });

  it('PATCH /suppliers/:id retorna o SupplierResponseDto sem deletedAt', async () => {
    const dto = { category: 'som' };
    const updated = { ...row, ...dto };
    service.update.mockResolvedValue(updated as never);

    const result = await controller.update('supplier-1', dto);

    expect(service.update).toHaveBeenCalledWith('supplier-1', dto);
    expect(result).toBeInstanceOf(SupplierResponseDto);
    expect(result).toEqual({ ...publicSupplier, ...dto });
  });

  it('DELETE /suppliers/:id delega para suppliersService.remove()', async () => {
    service.remove.mockResolvedValue(undefined as never);

    await controller.remove('supplier-1');

    expect(service.remove).toHaveBeenCalledWith('supplier-1');
  });
});
