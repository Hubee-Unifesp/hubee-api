import {
  Injectable,
  ConflictException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { eq, or, and, isNull } from 'drizzle-orm';
import { usuarios } from '../database/schema';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import * as bcrypt from 'bcrypt';
import { DRIZZLE } from '../database/database.constants';

@Injectable()
export class UsuariosService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  private excludePassword(user: any) {
    const { password: _password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async create(data: CreateUsuarioDto) {
    const existingUser = await this.db
      .select()
      .from(usuarios)
      .where(or(eq(usuarios.email, data.email), eq(usuarios.cpf, data.cpf)));

    if (existingUser.length > 0) {
      throw new ConflictException('E-mail ou CPF já cadastrados.');
    }
    const hashedPassword = await bcrypt.hash(data.senha, 10);
    const [newUser] = await this.db
      .insert(usuarios)
      .values({
        ...data,
        senha: hashedPassword,
        dataNascimento: new Date(data.dataNascimento)
          .toISOString()
          .split('T')[0],
      })
      .returning();
    return this.excludePassword(newUser);
  }

  async findAll() {
    const allUsers = await this.db
      .select()
      .from(usuarios)
      .where(isNull(usuarios.deletedAt));
    return allUsers.map((user: any) => this.excludePassword(user));
  }
  async findOne(id: string) {
    const [user] = await this.db
      .select()
      .from(usuarios)
      .where(and(eq(usuarios.id, id), isNull(usuarios.deletedAt)));
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    return this.excludePassword(user);
  }

  async update(id: string, data: UpdateUsuarioDto) {
    await this.findOne(id);

    const updateData: any = { ...data, dataModificacao: new Date() };

    if (data.senha) {
      updateData.senha = await bcrypt.hash(data.senha, 10);
    }
    if (data.dataNascimento) {
      updateData.dataNascimento = new Date(data.dataNascimento)
        .toISOString()
        .split('T')[0];
    }
    const [updatedUser] = await this.db
      .update(usuarios)
      .set(updateData)
      .where(eq(usuarios.id, id))
      .returning();

    return this.excludePassword(updatedUser);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.db
      .update(usuarios)
      .set({ deletedAt: new Date(), status: 'INATIVO' })
      .where(eq(usuarios.id, id));

    return { message: 'Usuário removido com sucesso.' };
  }
}
