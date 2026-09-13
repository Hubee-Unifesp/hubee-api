import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';

describe('OrganizationController', () => {
  let controller: OrganizationController;
  let service: {
    findAll: jest.Mock<OrganizationService['findAll']>;
    findOne: jest.Mock<OrganizationService['findOne']>;
    create: jest.Mock<OrganizationService['create']>;
    update: jest.Mock<OrganizationService['update']>;
    remove: jest.Mock<OrganizationService['remove']>;
  };

  beforeEach(async () => {
    service = {
      findAll: jest.fn<OrganizationService['findAll']>(),
      findOne: jest.fn<OrganizationService['findOne']>(),
      create: jest.fn<OrganizationService['create']>(),
      update: jest.fn<OrganizationService['update']>(),
      remove: jest.fn<OrganizationService['remove']>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationController],
      providers: [{ provide: OrganizationService, useValue: service }],
    }).compile();

    controller = module.get(OrganizationController);
  });

  it('POST /organizacoes delega para organizationService.create()', async () => {
    const dto: CreateOrganizationDto = { name: 'Centro Acadêmico' };
    const created = { id: 'org-1', ...dto } as never;
    service.create.mockResolvedValue(created);

    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(created);
  });

  it('GET /organizacoes delega para organizationService.findAll() com os filtros da query', async () => {
    const list = [{ id: 'org-1' }] as never;
    service.findAll.mockResolvedValue(list);

    const result = await controller.findAll({ name: 'Centro' });

    expect(service.findAll).toHaveBeenCalledWith({ name: 'Centro' });
    expect(result).toEqual(list);
  });

  it('GET /organizacoes/:id delega para organizationService.findOne()', async () => {
    const organization = { id: 'org-1' } as never;
    service.findOne.mockResolvedValue(organization);

    const result = await controller.findOne('org-1');

    expect(service.findOne).toHaveBeenCalledWith('org-1');
    expect(result).toEqual(organization);
  });

  it('PATCH /organizacoes/:id delega para organizationService.update()', async () => {
    const dto: UpdateOrganizationDto = { name: 'Novo nome' };
    const updated = { id: 'org-1', ...dto } as never;
    service.update.mockResolvedValue(updated);

    const result = await controller.update('org-1', dto);

    expect(service.update).toHaveBeenCalledWith('org-1', dto);
    expect(result).toEqual(updated);
  });

  it('DELETE /organizacoes/:id delega para organizationService.remove()', async () => {
    service.remove.mockResolvedValue(undefined);

    await controller.remove('org-1');

    expect(service.remove).toHaveBeenCalledWith('org-1');
  });
});
