import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { CreateFornecedorDto } from './dto/create-fornecedor.dto';
import { UpdateFornecedorDto } from './dto/update-fornecedor.dto';
import { eq, or, isNull } from 'drizzle-orm';
import { fornecedores } from '../database/schema';

@Injectable()
export class FornecedoresService {
  constructor(@Inject('DRIZZLE') private db: any) {}

  async create(createFornecedorDto: CreateFornecedorDto) {
    const conditions = [eq(fornecedores.cnpjCpf, createFornecedorDto.cnpjCpf)];

    if (createFornecedorDto.email) {
      conditions.push(eq(fornecedores.email, createFornecedorDto.email));
    }

    const fornecedorExistente = await this.db
      .select()
      .from(fornecedores)
      .where(or(...conditions))
      .limit(1);

    if (fornecedorExistente.length > 0) {
      throw new ConflictException(
        'Já existe um fornecedor com este CNPJ/CPF ou E-mail.',
      );
    }

    const [novoFornecedor] = await this.db
      .insert(fornecedores)
      .values(createFornecedorDto)
      .returning();

    return novoFornecedor;
  }

  async findAll() {
    return this.db
      .select()
      .from(fornecedores)
      .where(isNull(fornecedores.deletedAt));
  }

  async findOne(id: string) {
    const [fornecedor] = await this.db
      .select()
      .from(fornecedores)
      .where(eq(fornecedores.id, id));

    if (!fornecedor || fornecedor.deletedAt) {
      throw new NotFoundException('Fornecedor não encontrado.');
    }

    return fornecedor;
  }

  async update(id: string, updateFornecedorDto: UpdateFornecedorDto) {
    await this.findOne(id);

    const [fornecedorAtualizado] = await this.db
      .update(fornecedores)
      .set({ ...updateFornecedorDto, updatedAt: new Date() })
      .where(eq(fornecedores.id, id))
      .returning();

    return fornecedorAtualizado;
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.db
      .update(fornecedores)
      .set({ deletedAt: new Date() })
      .where(eq(fornecedores.id, id));

    return { message: 'Fornecedor removido com sucesso.' };
  }
}
