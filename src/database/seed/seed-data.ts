import type { EventAgeRating, EventStatus } from '../schema';
import {
  InviteStatus,
  OrganizationPermission,
  OrganizationRole,
} from '../../organization-users/dto/create-organization-user.dto';

/**
 * Dados iniciais da plataforma. Cada registro tem uma chave natural (e-mail,
 * nome) que o seed usa para não duplicar nada ao rodar de novo.
 *
 * As senhas NÃO ficam aqui: vêm de `SEED_ADMIN_PASSWORD` e
 * `SEED_USER_PASSWORD` na hora de rodar.
 */

export type SeedUserKey = 'admin' | 'organizer' | 'staff' | 'viewer' | 'buyer';

export interface SeedUser {
  key: SeedUserKey;
  fullName: string;
  email: string;
  role: 'USER' | 'ADMIN';
  signupIntent: 'BUY' | 'ORGANIZE' | null;
}

export const seedUsers: SeedUser[] = [
  {
    key: 'admin',
    fullName: 'Administrador Hubee',
    email: 'admin@hubee.com.br',
    role: 'ADMIN',
    signupIntent: null,
  },
  {
    key: 'organizer',
    fullName: 'Organizador Hubee',
    email: 'organizador@hubee.com.br',
    role: 'USER',
    signupIntent: 'ORGANIZE',
  },
  {
    key: 'staff',
    fullName: 'Equipe Hubee',
    email: 'equipe@hubee.com.br',
    role: 'USER',
    signupIntent: 'ORGANIZE',
  },
  {
    key: 'viewer',
    fullName: 'Leitor Hubee',
    email: 'leitor@hubee.com.br',
    role: 'USER',
    signupIntent: 'ORGANIZE',
  },
  {
    key: 'buyer',
    fullName: 'Comprador Hubee',
    email: 'comprador@hubee.com.br',
    role: 'USER',
    signupIntent: 'BUY',
  },
];

export interface SeedMembership {
  user: SeedUserKey;
  role: OrganizationRole;
  permission: OrganizationPermission;
}

export const seedOrganization = {
  name: 'Hubee Produções',
  description: 'Organização oficial da Hubee para eventos da plataforma.',
  representative: 'organizer' as SeedUserKey,
  // Um vínculo por nível de acesso (ver `effectiveLevel`):
  // admin + full = manage, member + full = write, member + read_only = read.
  memberships: [
    {
      user: 'organizer',
      role: OrganizationRole.ADMIN,
      permission: OrganizationPermission.FULL,
    },
    {
      user: 'staff',
      role: OrganizationRole.MEMBER,
      permission: OrganizationPermission.FULL,
    },
    {
      user: 'viewer',
      role: OrganizationRole.MEMBER,
      permission: OrganizationPermission.READ_ONLY,
    },
  ] satisfies SeedMembership[],
  inviteStatus: InviteStatus.ACCEPTED,
};

export interface SeedVenue {
  name: string;
  maxCapacity: number;
  address: {
    zipCode: string;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
  };
}

export const seedVenues: SeedVenue[] = [
  {
    name: 'Espaço Hubee Arena',
    maxCapacity: 5000,
    address: {
      zipCode: '01310-100',
      street: 'Avenida Paulista',
      number: '1000',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
    },
  },
  {
    name: 'Teatro Hubee',
    maxCapacity: 800,
    address: {
      zipCode: '20040-020',
      street: 'Rua da Assembleia',
      number: '50',
      neighborhood: 'Centro',
      city: 'Rio de Janeiro',
      state: 'RJ',
    },
  },
  {
    name: 'Centro de Convenções Hubee',
    maxCapacity: 2000,
    address: {
      zipCode: '30130-010',
      street: 'Avenida Afonso Pena',
      number: '1500',
      complement: 'Pavilhão B',
      neighborhood: 'Centro',
      city: 'Belo Horizonte',
      state: 'MG',
    },
  },
];

export interface SeedTicketType {
  batch: string;
  price: number;
  quantity: number;
}

export interface SeedEvent {
  name: string;
  description: string;
  venue: string;
  category: string;
  edition: string | null;
  ageRating: EventAgeRating;
  status: EventStatus;
  featured: boolean;
  startDate: string;
  endDate: string;
  salesStartDate: string;
  photoUrl: string | null;
  ticketTypes: SeedTicketType[];
}

export const seedEvents: SeedEvent[] = [
  {
    name: 'Festival Hubee de Música',
    description:
      'Dois dias de shows com artistas nacionais em três palcos simultâneos.',
    venue: 'Espaço Hubee Arena',
    category: 'Música',
    edition: '1ª edição',
    ageRating: '16',
    status: 'published',
    featured: true,
    startDate: '2026-12-12T18:00:00-03:00',
    endDate: '2026-12-13T23:59:00-03:00',
    salesStartDate: '2026-10-01T10:00:00-03:00',
    photoUrl: null,
    ticketTypes: [
      { batch: '1º Lote - Inteira', price: 180, quantity: 1500 },
      { batch: '1º Lote - Meia', price: 90, quantity: 500 },
      { batch: '2º Lote - Inteira', price: 220, quantity: 2000 },
      { batch: 'VIP', price: 450, quantity: 300 },
    ],
  },
  {
    name: 'Stand-up Hubee: Noite de Comédia',
    description: 'Uma noite com os melhores comediantes da nova geração.',
    venue: 'Teatro Hubee',
    category: 'Comédia',
    edition: null,
    ageRating: '14',
    status: 'published',
    featured: false,
    startDate: '2026-11-21T21:00:00-03:00',
    endDate: '2026-11-21T23:30:00-03:00',
    salesStartDate: '2026-10-15T10:00:00-03:00',
    photoUrl: null,
    ticketTypes: [
      { batch: 'Lote Único - Inteira', price: 80, quantity: 600 },
      { batch: 'Lote Único - Meia', price: 40, quantity: 200 },
    ],
  },
  {
    name: 'Hubee Tech Summit',
    description:
      'Conferência sobre tecnologia, produto e inovação com palestras e workshops.',
    venue: 'Centro de Convenções Hubee',
    category: 'Tecnologia',
    edition: '2027',
    ageRating: 'L',
    status: 'published',
    featured: true,
    startDate: '2027-03-18T09:00:00-03:00',
    endDate: '2027-03-19T18:00:00-03:00',
    salesStartDate: '2026-11-01T10:00:00-03:00',
    photoUrl: null,
    ticketTypes: [
      { batch: 'Early Bird', price: 250, quantity: 300 },
      { batch: '1º Lote', price: 350, quantity: 900 },
      { batch: 'Estudante', price: 120, quantity: 400 },
    ],
  },
  {
    name: 'Feira Gastronômica Hubee',
    description: 'Food trucks, chefs convidados e oficinas de culinária.',
    venue: 'Espaço Hubee Arena',
    category: 'Gastronomia',
    edition: null,
    ageRating: 'L',
    status: 'draft',
    featured: false,
    startDate: '2027-05-08T11:00:00-03:00',
    endDate: '2027-05-09T22:00:00-03:00',
    salesStartDate: '2027-02-01T10:00:00-03:00',
    photoUrl: null,
    ticketTypes: [{ batch: 'Entrada', price: 30, quantity: 3000 }],
  },
];
