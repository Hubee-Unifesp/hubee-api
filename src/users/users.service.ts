import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { normalizeEmail } from '../common/validation/normalize-email';
import { eq, or, and, isNull, ne } from 'drizzle-orm';
import { users } from '../database/schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
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
    data = { ...data, email: normalizeEmail(data.email) };
    const existingUser = await this.db
      .select()
      .from(users)
      .where(
        and(
          data.cpf
            ? or(eq(users.email, data.email), eq(users.cpf, data.cpf))
            : eq(users.email, data.email),
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
        role: 'USER',
        password: hashedPassword,
        birthDate: data.birthDate
          ? new Date(data.birthDate).toISOString().split('T')[0]
          : undefined,
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

  async findMe(id: string) {
    return this.withProfileStatus(await this.findOne(id));
  }

  async findByEmail(email: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(
        and(eq(users.email, normalizeEmail(email)), isNull(users.deletedAt)),
      );
    return user;
  }

  async update(id: string, data: UpdateUserDto) {
    if (data.email !== undefined) {
      data = { ...data, email: normalizeEmail(data.email) };
    }
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

  async updateMe(id: string, data: UpdateMeDto) {
    if (data.cpf !== undefined) {
      const current = await this.findOne(id);
      if (current.cpf && current.cpf !== data.cpf) {
        throw new BadRequestException('CPF não pode ser alterado');
      }
    }
    return this.withProfileStatus(await this.update(id, data));
  }

  async changePassword(id: string, data: ChangePasswordDto): Promise<void> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)));
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    const isMatch = await bcrypt.compare(data.currentPassword, user.password);
    if (!isMatch) throw new UnauthorizedException('Senha atual incorreta');

    await this.db
      .update(users)
      .set({
        password: await bcrypt.hash(data.newPassword, 10),
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
  }

  private withProfileStatus<
    T extends { cpf: string | null; birthDate: string | null },
  >(user: T) {
    return { ...user, profileComplete: Boolean(user.cpf && user.birthDate) };
  }
}
