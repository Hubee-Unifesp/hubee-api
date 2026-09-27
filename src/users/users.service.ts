import {
  Injectable,
  ConflictException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { eq, or, and, isNull, ne } from 'drizzle-orm';
import { users } from '../database/schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { DRIZZLE } from '../database/database.constants';

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  private excludePassword(user: any) {
    const { password: _password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async create(data: CreateUserDto) {
    const existingUser = await this.db
      .select()
      .from(users)
      .where(
        and(
          or(eq(users.email, data.email), eq(users.cpf, data.cpf)),
          isNull(users.deletedAt),
        ),
      );

    if (existingUser.length > 0) {
      throw new ConflictException('E-mail ou CPF já cadastrados.');
    }
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const [newUser] = await this.db
      .insert(users)
      .values({
        ...data,
        password: hashedPassword,
        birthDate: new Date(data.birthDate).toISOString().split('T')[0],
      })
      .returning();

    return this.excludePassword(newUser);
  }

  async findAll() {
    const allUsers = await this.db
      .select()
      .from(users)
      .where(isNull(users.deletedAt));

    return allUsers.map((user: any) => this.excludePassword(user));
  }

  async findOne(id: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)));

    if (!user) throw new NotFoundException('Usuário não encontrado.');

    return this.excludePassword(user);
  }

  async findByEmail(email: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)));
    return user;
  }

  async update(id: string, data: UpdateUserDto) {
    await this.findOne(id);

    if (data.email || data.cpf) {
      const conflictConditions = [
        data.email ? eq(users.email, data.email) : undefined,
        data.cpf ? eq(users.cpf, data.cpf) : undefined,
      ].filter((c) => c !== undefined);

      const conflictingUser = await this.db
        .select()
        .from(users)
        .where(
          and(
            or(...conflictConditions),
            isNull(users.deletedAt),
            ne(users.id, id),
          ),
        );

      if (conflictingUser.length > 0) {
        throw new ConflictException('E-mail ou CPF já cadastrados.');
      }
    }

    const updateData: any = { ...data, updatedAt: new Date() };

    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }
    if (data.birthDate) {
      updateData.birthDate = new Date(data.birthDate)
        .toISOString()
        .split('T')[0];
    }
    const [updatedUser] = await this.db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();

    return this.excludePassword(updatedUser);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.db
      .update(users)
      .set({ deletedAt: new Date(), status: 'INACTIVE' })
      .where(eq(users.id, id));
  }
}
