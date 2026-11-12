import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { QuerySupplierDto } from './dto/query-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CreateSupplierReviewDto } from './dto/create-supplier-review.dto';
import { eq, or, isNull, and, ne, ilike, desc, sql } from 'drizzle-orm';
import { supplierReviews, suppliers, users } from '../database/schema';

const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');

const reviewColumns = {
  id: supplierReviews.id,
  supplierId: supplierReviews.supplierId,
  userId: supplierReviews.userId,
  userName: users.fullName,
  rating: supplierReviews.rating,
  comment: supplierReviews.comment,
  createdAt: supplierReviews.createdAt,
  updatedAt: supplierReviews.updatedAt,
};

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

  async findAll(query: QuerySupplierDto = {}) {
    const conditions = [
      isNull(suppliers.deletedAt),
      query.search
        ? ilike(suppliers.companyName, `%${escapeLike(query.search)}%`)
        : undefined,
      query.category
        ? ilike(suppliers.category, escapeLike(query.category))
        : undefined,
    ].filter((c) => c !== undefined);

    return this.db
      .select()
      .from(suppliers)
      .where(and(...conditions));
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

  async saveReview(
    supplierId: string,
    userId: string,
    dto: CreateSupplierReviewDto,
  ) {
    await this.findOne(supplierId);

    const values = { rating: dto.rating, comment: dto.comment || null };
    const [saved] = await this.db
      .insert(supplierReviews)
      .values({ supplierId, userId, ...values })
      .onConflictDoUpdate({
        target: [supplierReviews.supplierId, supplierReviews.userId],
        set: { ...values, updatedAt: sql`now()` },
      })
      .returning({ id: supplierReviews.id, created: sql<boolean>`xmax = 0` });

    const [review] = await this.db
      .select(reviewColumns)
      .from(supplierReviews)
      .innerJoin(users, eq(users.id, supplierReviews.userId))
      .where(eq(supplierReviews.id, saved.id));

    return { review, created: saved.created };
  }

  async findReviews(supplierId: string) {
    await this.findOne(supplierId);

    return this.db
      .select(reviewColumns)
      .from(supplierReviews)
      .innerJoin(users, eq(users.id, supplierReviews.userId))
      .where(eq(supplierReviews.supplierId, supplierId))
      .orderBy(desc(supplierReviews.updatedAt), desc(supplierReviews.id));
  }
}
