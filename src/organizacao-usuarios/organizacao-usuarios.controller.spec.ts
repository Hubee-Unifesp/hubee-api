import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { OrganizacaoUsuariosController } from './organizacao-usuarios.controller';
import { OrganizacaoUsuariosService } from './organizacao-usuarios.service';

describe('OrganizacaoUsuariosController', () => {
  let controller: OrganizacaoUsuariosController;
  let service: {
    create: jest.Mock<(orgId: string, dto: any) => Promise<any>>;
    findAll: jest.Mock<(orgId: string) => Promise<any>>;
    update: jest.Mock<
      (orgId: string, userId: string, dto: any) => Promise<any>
    >;
    remove: jest.Mock<(orgId: string, userId: string) => Promise<any>>;
  };

  const orgId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const userId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  beforeEach(async () => {
    service = {
      create: jest.fn<(orgId: string, dto: any) => Promise<any>>(),
      findAll: jest.fn<(orgId: string) => Promise<any>>(),
      update:
        jest.fn<(orgId: string, userId: string, dto: any) => Promise<any>>(),
      remove: jest.fn<(orgId: string, userId: string) => Promise<any>>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizacaoUsuariosController],
      providers: [{ provide: OrganizacaoUsuariosService, useValue: service }],
    }).compile();

    controller = module.get<OrganizacaoUsuariosController>(
      OrganizacaoUsuariosController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create() repassa orgId e dto pro service', async () => {
    const dto = { userId, papel: 'admin', permissao: 'total' } as any;
    const respostaFalsa = { orgId, ...dto };
    service.create.mockResolvedValueOnce(respostaFalsa);

    const resultado = await controller.create(orgId, dto);

    expect(service.create).toHaveBeenCalledWith(orgId, dto);
    expect(resultado).toEqual(respostaFalsa);
  });

  it('findAll() repassa orgId pro service', async () => {
    const listaFalsa = [{ orgId, userId }];
    service.findAll.mockResolvedValueOnce(listaFalsa);

    const resultado = await controller.findAll(orgId);

    expect(service.findAll).toHaveBeenCalledWith(orgId);
    expect(resultado).toEqual(listaFalsa);
  });

  it('update() repassa orgId, userId e dto pro service', async () => {
    const dto = { statusConvite: 'aceito' } as any;
    const respostaFalsa = { orgId, userId, ...dto };
    service.update.mockResolvedValueOnce(respostaFalsa);

    const resultado = await controller.update(orgId, userId, dto);

    expect(service.update).toHaveBeenCalledWith(orgId, userId, dto);
    expect(resultado).toEqual(respostaFalsa);
  });

  it('remove() repassa orgId e userId pro service', async () => {
    const respostaFalsa = { message: 'Vínculo removido com sucesso.' };
    service.remove.mockResolvedValueOnce(respostaFalsa);

    const resultado = await controller.remove(orgId, userId);

    expect(service.remove).toHaveBeenCalledWith(orgId, userId);
    expect(resultado).toEqual(respostaFalsa);
  });
});
