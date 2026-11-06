import { Inject, Injectable } from '@nestjs/common';
import { eq, ilike } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.constants';
import type {
  DbExecutor,
  DrizzleDatabase,
} from '../database/database.provider';
import { organizations, organizationUsers } from '../database/schema';

export interface FindAllOrganizationsFilters {
  name?: string;
}

@Injectable()
export class OrganizationRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async findAll(
    filters: FindAllOrganizationsFilters,
    executor: DbExecutor = this.db,
  ) {
    return executor
      .select()
      .from(organizations)
      .where(
        filters.name
          ? ilike(organizations.name, `%${filters.name}%`)
          : undefined,
      );
  }

  async findById(id: string, executor: DbExecutor = this.db) {
    return executor.query.organizations.findFirst({
      where: eq(organizations.id, id),
    });
  }

  async create(
    data: typeof organizations.$inferInsert,
    executor: DbExecutor = this.db,
  ) {
    const [organization] = await executor
      .insert(organizations)
      .values(data)
      .returning();
    return organization;
  }

  async addMember(
    data: typeof organizationUsers.$inferInsert,
    executor: DbExecutor = this.db,
  ) {
    const [membership] = await executor
      .insert(organizationUsers)
      .values(data)
      .returning();
    return membership;
  }

  async update(
    id: string,
    data: Partial<typeof organizations.$inferInsert>,
    executor: DbExecutor = this.db,
  ) {
    const [organization] = await executor
      .update(organizations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning();
    return organization;
  }

  async delete(id: string, executor: DbExecutor = this.db): Promise<void> {
    await executor.delete(organizations).where(eq(organizations.id, id));
  }
}
