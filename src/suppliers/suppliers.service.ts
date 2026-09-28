import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { eq, or, isNull, and, ne } from 'drizzle-orm';
import { suppliers } from '../database/schema';

@Injectable()
export class SuppliersService {
  constructor(@Inject('DRIZZLE') private db: any) {}

  async create(createSupplierDto: CreateSupplierDto) {
    const conditions = [eq(suppliers.cnpjCpf, createSupplierDto.cnpjCpf)];

    if (createSupplierDto.email) {
      conditions.push(eq(suppliers.email, createSupplierDto.email));
    }

    const existingSupplier = await this.db
      .select()
      .from(suppliers)
      .where(and(or(...conditions), isNull(suppliers.deletedAt)))
      .limit(1);

    if (existingSupplier.length > 0) {
      throw new ConflictException(
        'Já existe um fornecedor com este CNPJ/CPF ou E-mail.',
      );
    }

    const [newSupplier] = await this.db
      .insert(suppliers)
      .values(createSupplierDto)
      .returning();

    return newSupplier;
  }

  async findAll() {
    return this.db.select().from(suppliers).where(isNull(suppliers.deletedAt));
  }

  async findOne(id: string) {
    const [supplier] = await this.db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, id));

    if (!supplier || supplier.deletedAt) {
      throw new NotFoundException('Fornecedor não encontrado.');
    }

    return supplier;
  }

  async update(id: string, updateSupplierDto: UpdateSupplierDto) {
    await this.findOne(id);

    if (updateSupplierDto.cnpjCpf || updateSupplierDto.email) {
      const conflictConditions = [
        updateSupplierDto.cnpjCpf
          ? eq(suppliers.cnpjCpf, updateSupplierDto.cnpjCpf)
          : undefined,
        updateSupplierDto.email
          ? eq(suppliers.email, updateSupplierDto.email)
          : undefined,
      ].filter((c) => c !== undefined);

      const conflictingSupplier = await this.db
        .select()
        .from(suppliers)
        .where(
          and(
            or(...conflictConditions),
            isNull(suppliers.deletedAt),
            ne(suppliers.id, id),
          ),
        )
        .limit(1);

      if (conflictingSupplier.length > 0) {
        throw new ConflictException(
          'Já existe um fornecedor com este CNPJ/CPF ou E-mail.',
        );
      }
    }

    const [updatedSupplier] = await this.db
      .update(suppliers)
      .set({ ...updateSupplierDto, updatedAt: new Date() })
      .where(eq(suppliers.id, id))
      .returning();

    return updatedSupplier;
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);

    await this.db
      .update(suppliers)
      .set({ deletedAt: new Date() })
      .where(eq(suppliers.id, id));
  }
}
