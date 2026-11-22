import { describe, expect, it } from '@jest/globals';
import type { ClassConstructor } from 'class-transformer';
import { toResponse } from './to-response';
import { AddressResponseDto } from '../../address/dto/address-response.dto';
import { LoginResponseDto } from '../../auth/dto/login-response.dto';
import { RegisterResponseDto } from '../../auth/dto/register-response.dto';
import { EventResponseDto } from '../../event/dto/event-response.dto';
import {
  EventAiDraftResponseDto,
  SuggestedTicketTypeDto,
  VenueSuggestionDto,
} from '../../event/dto/event-ai-draft-response.dto';
import {
  EventDetailOrganizationDto,
  EventDetailResponseDto,
  EventDetailVenueDto,
} from '../../event/dto/event-detail-response.dto';
import { EventSummaryResponseDto } from '../../event/dto/event-summary-response.dto';
import { EventListItemResponseDto } from '../../event/dto/event-list-item-response.dto';
import { EventPageResponseDto } from '../../event/dto/event-page-response.dto';
import { PaginationMetaDto } from '../pagination/pagination-meta.dto';
import { ExpenseResponseDto } from '../../expenses/dto/expense-response.dto';
import { OrderResponseDto } from '../../order/dto/order-response.dto';
import { OrganizationEventResponseDto } from '../../organization-event/dto/organization-event-response.dto';
import { OrganizationUserResponseDto } from '../../organization-users/dto/organization-user-response.dto';
import { UserInviteResponseDto } from '../../organization-users/dto/user-invite-response.dto';
import { OrganizationResponseDto } from '../../organization/dto/organization-response.dto';
import { PaymentResponseDto } from '../../payment/dto/payment-response.dto';
import { SupplierResponseDto } from '../../suppliers/dto/supplier-response.dto';
import { TaskResponseDto } from '../../task/dto/task-response.dto';
import { TicketTypeResponseDto } from '../../ticket-type/dto/ticket-type-response.dto';
import { TicketResponseDto } from '../../ticket/dto/ticket-response.dto';
import {
  MeOrganizationDto,
  MeResponseDto,
  UserResponseDto,
} from '../../users/dto/user-response.dto';
import { VenueResponseDto } from '../../venue/dto/venue-response.dto';

/**
 * Chave onde o `@ApiProperty` registra as propriedades do DTO (inclui as
 * herdadas). O `@nestjs/swagger` não exporta a constante publicamente.
 */
const SWAGGER_PROPERTIES_KEY = 'swagger/apiModelPropertiesArray';

/** Propriedades documentadas no OpenAPI (via `@ApiProperty`) de um DTO. */
function documentedKeys(dto: ClassConstructor<unknown>): string[] {
  const keys: string[] =
    Reflect.getMetadata(SWAGGER_PROPERTIES_KEY, dto.prototype) ?? [];
  return keys.map((key) => key.replace(/^:/, '')).sort();
}

const RESPONSE_DTOS: ClassConstructor<unknown>[] = [
  AddressResponseDto,
  LoginResponseDto,
  RegisterResponseDto,
  EventResponseDto,
  EventDetailOrganizationDto,
  EventDetailVenueDto,
  EventDetailResponseDto,
  EventSummaryResponseDto,
  EventListItemResponseDto,
  EventPageResponseDto,
  EventAiDraftResponseDto,
  VenueSuggestionDto,
  SuggestedTicketTypeDto,
  PaginationMetaDto,
  ExpenseResponseDto,
  OrderResponseDto,
  OrganizationEventResponseDto,
  OrganizationUserResponseDto,
  UserInviteResponseDto,
  OrganizationResponseDto,
  PaymentResponseDto,
  SupplierResponseDto,
  TaskResponseDto,
  TicketTypeResponseDto,
  TicketResponseDto,
  UserResponseDto,
  MeResponseDto,
  MeOrganizationDto,
  VenueResponseDto,
];

describe('toResponse', () => {
  const row = {
    id: 'supplier-1',
    companyName: 'Som & Luz',
    cnpjCpf: '12345678000190',
    phone: null,
    email: 'contato@someluz.com',
    category: 'infraestrutura',
    ratingAverage: 4.5,
    ratingCount: 2,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    deletedAt: null,
  };

  it('retorna instância do DTO só com os campos expostos', () => {
    const result = toResponse(SupplierResponseDto, row);

    expect(result).toBeInstanceOf(SupplierResponseDto);
    const { deletedAt: _deletedAt, ...expected } = row;
    expect({ ...result }).toStrictEqual(expected);
  });

  it('mapeia cada item de uma lista', () => {
    const result = toResponse(SupplierResponseDto, [row, row]);

    expect(result).toHaveLength(2);
    for (const item of result) {
      expect(item).toBeInstanceOf(SupplierResponseDto);
      expect(item).not.toHaveProperty('deletedAt');
    }
  });

  it('campos ausentes na origem não aparecem no JSON da resposta', () => {
    const result = toResponse(SupplierResponseDto, { id: 'supplier-1' });

    expect(JSON.parse(JSON.stringify(result))).toStrictEqual({
      id: 'supplier-1',
    });
  });

  it('mapeia objetos aninhados para o DTO correspondente', () => {
    const result = toResponse(VenueResponseDto, {
      id: 'venue-1',
      address: { id: 'addr-1', city: 'Recife', internal: 'x' },
    });

    expect(result.address).toBeInstanceOf(AddressResponseDto);
    expect(JSON.parse(JSON.stringify(result))).toStrictEqual({
      id: 'venue-1',
      address: { id: 'addr-1', city: 'Recife' },
    });
  });
});

describe('toResponse(EventPageResponseDto)', () => {
  it('mapeia os itens e os metadados da página, sem campos internos', () => {
    const result = toResponse(EventPageResponseDto, {
      data: [
        {
          id: 'event-1',
          name: 'Show',
          venueName: 'Marco Zero',
          venueCity: 'Recife',
          minPrice: 0,
          minPriceBatch: 'Lote gratuito',
          venueAddressId: 'addr-1',
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1, offset: 0 },
    });

    expect(result.data[0]).toBeInstanceOf(EventListItemResponseDto);
    expect(result.meta).toBeInstanceOf(PaginationMetaDto);
    expect(JSON.parse(JSON.stringify(result))).toStrictEqual({
      data: [
        {
          id: 'event-1',
          name: 'Show',
          venueName: 'Marco Zero',
          venueCity: 'Recife',
          minPrice: 0,
          minPriceBatch: 'Lote gratuito',
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it('página vazia mantém data como array vazio', () => {
    const result = toResponse(EventPageResponseDto, {
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    expect(JSON.parse(JSON.stringify(result))).toStrictEqual({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });
});

describe('toResponse(OrganizationUserResponseDto e UserInviteResponseDto)', () => {
  it('expõe userName e userEmail em OrganizationUserResponseDto sem campos extras', () => {
    const result = toResponse(OrganizationUserResponseDto, {
      orgId: 'org-1',
      userId: 'user-1',
      userName: 'Maria Silva',
      userEmail: 'maria@example.com',
      role: 'member',
      permission: 'full',
      inviteStatus: 'pending',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      password: 'secret',
    });

    expect(result).toBeInstanceOf(OrganizationUserResponseDto);
    expect(JSON.parse(JSON.stringify(result))).toStrictEqual({
      orgId: 'org-1',
      userId: 'user-1',
      userName: 'Maria Silva',
      userEmail: 'maria@example.com',
      role: 'member',
      permission: 'full',
      inviteStatus: 'pending',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('expõe organizationName no UserInviteResponseDto sem campos extras', () => {
    const result = toResponse(UserInviteResponseDto, {
      orgId: 'org-1',
      organizationName: 'Atlética Unifesp',
      userId: 'user-1',
      role: 'member',
      permission: 'read_only',
      inviteStatus: 'pending',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      internalField: 'ignorado',
    });

    expect(result).toBeInstanceOf(UserInviteResponseDto);
    expect(JSON.parse(JSON.stringify(result))).toStrictEqual({
      orgId: 'org-1',
      organizationName: 'Atlética Unifesp',
      userId: 'user-1',
      role: 'member',
      permission: 'read_only',
      inviteStatus: 'pending',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  });
});

describe('toResponse(EventDetailResponseDto)', () => {
  it('mapeia evento, local com endereço, organização e lotes sem campos internos', () => {
    const result = toResponse(EventDetailResponseDto, {
      id: 'event-1',
      name: 'Semana da Computação',
      internalSecret: 'x',
      venue: {
        id: 'venue-1',
        name: 'Auditório Talim',
        maxCapacity: 300,
        active: true,
        addressId: 'addr-1',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        internalVenueField: 'y',
        address: {
          id: 'addr-1',
          city: 'São José dos Campos',
          state: 'SP',
          internalAddressField: 'z',
        },
      },
      organization: {
        id: 'org-1',
        name: 'CACOMP',
        description: 'Centro Acadêmico',
        representativeId: 'user-1',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        internalOrgField: 'w',
      },
      ticketTypes: [
        {
          id: 'tt-1',
          eventId: 'event-1',
          batch: '1º Lote',
          price: 25,
          quantity: 100,
          internalBatchField: 'k',
        },
      ],
    });

    expect(result).toBeInstanceOf(EventDetailResponseDto);
    expect(result.venue).toBeInstanceOf(EventDetailVenueDto);
    expect(result.venue.address).toBeInstanceOf(AddressResponseDto);
    expect(result.organization).toBeInstanceOf(EventDetailOrganizationDto);
    expect(result.ticketTypes[0]).toBeInstanceOf(TicketTypeResponseDto);
    expect(JSON.parse(JSON.stringify(result))).toStrictEqual({
      id: 'event-1',
      name: 'Semana da Computação',
      venue: {
        id: 'venue-1',
        name: 'Auditório Talim',
        maxCapacity: 300,
        address: {
          id: 'addr-1',
          city: 'São José dos Campos',
          state: 'SP',
        },
      },
      organization: {
        id: 'org-1',
        name: 'CACOMP',
        description: 'Centro Acadêmico',
      },
      ticketTypes: [
        {
          id: 'tt-1',
          eventId: 'event-1',
          batch: '1º Lote',
          price: 25,
          quantity: 100,
        },
      ],
    });
  });
});

describe('toResponse(EventAiDraftResponseDto)', () => {
  it('mapeia o rascunho com local e lotes, sem campos extras', () => {
    const result = toResponse(EventAiDraftResponseDto, {
      name: 'Festa Junina',
      description: null,
      category: 'festas',
      ageRating: null,
      edition: null,
      startDate: '2026-11-28T20:00:00-03:00',
      endDate: null,
      venueSuggestion: {
        name: 'Ginásio',
        address: null,
        city: 'São José dos Campos',
        state: 'SP',
        venueId: 'interno',
      },
      suggestedTicketTypes: [
        {
          batch: '1º lote',
          price: 30,
          quantity: null,
          modality: 'inteira',
          eventId: 'interno',
        },
      ],
      missingFields: ['description', 'ageRating', 'edition', 'endDate'],
      organizerId: 'interno',
    });

    expect(result.venueSuggestion).toBeInstanceOf(VenueSuggestionDto);
    expect(result.suggestedTicketTypes[0]).toBeInstanceOf(
      SuggestedTicketTypeDto,
    );
    expect(JSON.parse(JSON.stringify(result))).toEqual({
      name: 'Festa Junina',
      description: null,
      category: 'festas',
      ageRating: null,
      edition: null,
      startDate: '2026-11-28T20:00:00-03:00',
      endDate: null,
      venueSuggestion: {
        name: 'Ginásio',
        address: null,
        city: 'São José dos Campos',
        state: 'SP',
      },
      suggestedTicketTypes: [
        { batch: '1º lote', price: 30, quantity: null, modality: 'inteira' },
      ],
      missingFields: ['description', 'ageRating', 'edition', 'endDate'],
    });
  });
});

describe('contrato dos *ResponseDto (runtime == OpenAPI)', () => {
  it.each(RESPONSE_DTOS.map((dto) => [dto.name, dto] as const))(
    '%s expõe exatamente as propriedades documentadas',
    (_name, dto) => {
      const keys = documentedKeys(dto);
      expect(keys.length).toBeGreaterThan(0);

      const source: Record<string, unknown> = {
        password: 'hash',
        deletedAt: new Date(),
        colunaNaoDocumentada: 'x',
      };
      for (const key of keys) source[key] = {};

      const result = JSON.parse(JSON.stringify(toResponse(dto, source)));

      expect(Object.keys(result).sort()).toEqual(keys);
    },
  );
});
