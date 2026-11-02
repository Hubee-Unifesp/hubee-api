import { jest, describe, expect, it, beforeEach } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { DRIZZLE } from '../database/database.constants';

describe('UsersService', () => {
  let service: UsersService;

  const mockUserRow = {
    id: 'user-1',
    fullName: 'Maria Silva',
    email: 'maria@example.com',
    phone: '11999999999',
    avatarUrl: null,
    password: 'hashed-password',
    cpf: '52998224725',
    birthDate: '1990-05-20',
    role: 'USER' as const,
    signupIntent: 'BUY' as const,
    status: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
  };

  let selectResult: unknown[] = [mockUserRow];
  let returningResult: unknown[] = [];

  const mockDb = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn(() => Promise.resolve(selectResult)),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest.fn(() => Promise.resolve(returningResult)),
      }),
    }),
  };

  beforeEach(async () => {
    selectResult = [mockUserRow];
    returningResult = [];
    jest.clearAllMocks();
    mockDb.where.mockImplementation(() => Promise.resolve(selectResult));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: DRIZZLE,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('deve estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('updateAvatar', () => {
    it('converte imagem válida para Data URI e persiste avatarUrl no usuário', async () => {
      const buffer = Buffer.from('fake-png-bytes');
      const expectedAvatarUrl = `data:image/png;base64,${buffer.toString('base64')}`;
      returningResult = [{ ...mockUserRow, avatarUrl: expectedAvatarUrl }];

      let callCount = 0;
      mockDb.where.mockImplementation(() => {
        callCount += 1;
        if (callCount === 1) {
          return Promise.resolve([mockUserRow]);
        }
        return {
          orderBy: () => Promise.resolve([]),
        } as unknown as Promise<unknown[]>;
      });

      const result = await service.updateAvatar('user-1', {
        mimetype: 'image/png',
        buffer,
        size: buffer.length,
      });

      expect(mockDb.update).toHaveBeenCalledTimes(1);
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          avatarUrl: expectedAvatarUrl,
          updatedAt: expect.any(Date),
        }),
      );
      expect(result).toMatchObject({
        id: 'user-1',
        avatarUrl: expectedAvatarUrl,
        profileComplete: true,
        organizations: [],
      });
    });

    it('lança BadRequestException quando o arquivo está ausente ou vazio', async () => {
      await expect(service.updateAvatar('user-1', undefined)).rejects.toThrow(
        new BadRequestException('Arquivo de imagem é obrigatório.'),
      );
      await expect(
        service.updateAvatar('user-1', {
          mimetype: 'image/png',
          buffer: Buffer.alloc(0),
          size: 0,
        }),
      ).rejects.toThrow(
        new BadRequestException('Arquivo de imagem é obrigatório.'),
      );
    });

    it('lança BadRequestException para formato de arquivo não suportado', async () => {
      await expect(
        service.updateAvatar('user-1', {
          mimetype: 'image/gif',
          buffer: Buffer.from('gif'),
          size: 3,
        }),
      ).rejects.toThrow(
        new BadRequestException(
          'Formato inválido. Use uma imagem .jpg, .png ou .jpeg.',
        ),
      );
    });

    it('lança BadRequestException quando a imagem ultrapassa 2MB', async () => {
      const oversized = Buffer.alloc(2 * 1024 * 1024 + 1, 1);
      await expect(
        service.updateAvatar('user-1', {
          mimetype: 'image/jpeg',
          buffer: oversized,
          size: oversized.length,
        }),
      ).rejects.toThrow(
        new BadRequestException('A imagem deve ter no máximo 2MB.'),
      );
    });

    it('lança NotFoundException se o usuário não existir', async () => {
      selectResult = [];
      await expect(
        service.updateAvatar('inexistente', {
          mimetype: 'image/png',
          buffer: Buffer.from('ok'),
          size: 2,
        }),
      ).rejects.toThrow(new NotFoundException('Usuário não encontrado.'));
    });
  });
});
