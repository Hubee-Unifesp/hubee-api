import { jest } from '@jest/globals';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';

type AnyAsyncFn = (...args: any[]) => Promise<any>;

function makeDb(selectResult: any[]) {
  const updateWhere = jest.fn<AnyAsyncFn>().mockResolvedValue(undefined);
  const set = jest
    .fn<(values: any) => { where: typeof updateWhere }>()
    .mockReturnValue({ where: updateWhere });
  const update = jest.fn<() => { set: typeof set }>().mockReturnValue({ set });
  const db = {
    select: () => ({
      from: () => ({ where: () => Promise.resolve(selectResult) }),
    }),
    update,
  };
  return { db, update, set, updateWhere };
}

describe('UsersService (rotas /me)', () => {
  describe('updateMe', () => {
    it('repassa ao update apenas os 4 campos permitidos', async () => {
      const { db } = makeDb([]);
      const service = new UsersService(db);
      const spy = jest
        .spyOn(service, 'update')
        .mockResolvedValue({ id: 'u1' } as never);

      const sneaky = {
        fullName: 'Maria',
        email: 'maria@example.com',
        phone: '11999999999',
        birthDate: '1990-01-01',
        cpf: '99999999999',
        role: 'ADMIN',
        status: 'BLOCKED',
        password: 'hack',
      } as any;
      await service.updateMe('u1', sneaky);

      expect(spy).toHaveBeenCalledWith('u1', {
        fullName: 'Maria',
        email: 'maria@example.com',
        phone: '11999999999',
        birthDate: '1990-01-01',
      });
    });
  });

  describe('changePassword', () => {
    it('lança 404 quando o usuário não existe', async () => {
      const { db, update } = makeDb([]);
      const service = new UsersService(db);

      await expect(
        service.changePassword('u1', 'antiga123', 'nova12345'),
      ).rejects.toThrow(NotFoundException);
      expect(update).not.toHaveBeenCalled();
    });

    it('lança 401 com a senha atual errada e não grava nada', async () => {
      const hash = await bcrypt.hash('antiga123', 4);
      const { db, update } = makeDb([{ id: 'u1', password: hash }]);
      const service = new UsersService(db);

      await expect(
        service.changePassword('u1', 'errada', 'nova12345'),
      ).rejects.toThrow(UnauthorizedException);
      expect(update).not.toHaveBeenCalled();
    });

    it('com a senha atual correta grava o hash da nova senha', async () => {
      const hash = await bcrypt.hash('antiga123', 4);
      const { db, set } = makeDb([{ id: 'u1', password: hash }]);
      const service = new UsersService(db);

      await service.changePassword('u1', 'antiga123', 'nova12345');

      const saved = set.mock.calls[0][0];
      expect(saved.password).not.toBe('nova12345');
      await expect(bcrypt.compare('nova12345', saved.password)).resolves.toBe(
        true,
      );
      await expect(bcrypt.compare('antiga123', saved.password)).resolves.toBe(
        false,
      );
    });
  });
});
