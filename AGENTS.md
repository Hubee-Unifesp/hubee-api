# AGENTS.md — Hubee API

> **Instruções para Agentes de IA e Desenvolvedores**  
> Repositório: `hubee-api` (Backend do ecossistema Hubee)  
> Documentação viva do time: [Alexandrita Docs](https://alexandrita-docs.vercel.app)

---

## 1. Visão Geral do Repositório

A `hubee-api` é uma API RESTful modular construída em **NestJS** e **TypeScript**, responsável pelas regras de negócio, autenticação, persistência e processamento de eventos, ingressos, usuários e organizações da plataforma Hubee.

- **Porta Padrão:** `http://localhost:3000`
- **Documentação Interativa (Swagger):** `http://localhost:3000/docs` (quando rodando)
- **Banco de Dados:** PostgreSQL (hospedado no Neon em nuvem ou Postgres local; testes usam PGlite em memória).

---

## 2. Stack Tecnológica

| Componente | Tecnologia / Versão |
| :--- | :--- |
| **Framework Web** | NestJS v12 (`@nestjs/core`, `@nestjs/common`, `@nestjs/swagger`) |
| **Linguagem & Runtime** | Node.js (>= 20) / TypeScript v5+ |
| **ORM / Query Builder** | Drizzle ORM (`drizzle-orm`, `drizzle-kit`) |
| **Driver de Banco** | `pg` (PostgreSQL) / `@electric-sql/pglite` (Testes isolados em memória) |
| **Validação & DTOs** | `class-validator`, `class-transformer` |
| **Segurança & Tokens** | `@nestjs/jwt`, `bcrypt` |
| **Linter & Formatação** | `oxlint` (ultrarrápido, `--deny-warnings`) + Prettier |
| **Testes** | Jest (com suporte a ESM/VM modules: `--experimental-vm-modules`) |
| **Git Hooks** | Husky + Commitlint (`@commitlint/config-conventional`) |

---

## 3. Estrutura de Pastas e Arquitetura

```text
hubee-api/
├── drizzle/                     # Arquivos gerados de migrations SQL
├── src/
│   ├── address/                 # Módulo de endereços
│   ├── auth/                    # Autenticação, JWT, guards, decorators e testes de rotas
│   │   ├── decorators/          # @Authenticated(), @AdminOnly(), @CurrentUser(), etc.
│   │   ├── dto/                 # DTOs de login, registro e tokens
│   │   ├── guards/              # JwtAuthGuard, RolesGuard, etc.
│   │   ├── route-protection.spec.ts  # ⚠️ SUITE OBRIGATÓRIA DE TESTES DE PROTEÇÃO
│   │   └── auth.service.ts
│   ├── common/                  # Utilitários compartilhados
│   │   ├── serialization/       # to-response.ts e to-response.spec.ts
│   │   └── validation/          # Validadores customizados (CPF, datas, etc.)
│   ├── config/                  # Validação e carregamento de variáveis de ambiente
│   ├── database/                # Conexão Drizzle, schema definitions e database module
│   ├── event/                   # Eventos (criação, listagem, filtros, detalhamento)
│   ├── expenses/                # Despesas e financeiro do organizador
│   ├── health/                  # Endpoint /health
│   ├── order/                   # Pedidos e transações
│   ├── organization/            # Organizações de eventos e permissões
│   ├── organization-event/      # Vínculo entre organizações e eventos
│   ├── organization-users/      # Papéis de membros na organização (OWNER, ADMIN, MEMBER)
│   ├── payment/                 # Gateways e status de pagamento
│   ├── suppliers/               # Fornecedores de eventos
│   ├── task/                    # Tarefas operacionais de eventos
│   ├── ticket/                  # Ingressos emitidos
│   ├── ticket-type/             # Lotes e tipos de ingressos
│   ├── users/                   # Perfil, gerenciamento de usuários e /users/me
│   ├── venue/                   # Locais físicos de eventos
│   ├── app.module.ts            # Módulo raiz importando todos os submódulos
│   └── main.ts                  # Bootstrap da aplicação (Swagger, ValidationPipe, CORS)
└── test/                        # Testes E2E (Jest E2E com setup-e2e.ts)
```

---

## 4. Comandos Canônicos do Repositório

Sempre execute os comandos a partir da raiz `hubee-api`:

```bash
# Instalação de dependências
npm install

# Desenvolvimento local (watch mode na porta 3000)
npm run start:dev

# Linters e Estilo (DEVE passar sem nenhum warning)
npm run lint

# Formatação Prettier
npm run format

# Execução de Testes Unitários e de Integração
npm run test

# Execução de Testes em Modo Watch
npm run test:watch

# Execução de Testes com Cobertura
npm run test:cov

# Execução de Testes E2E
npm run test:e2e

# Operações do Banco de Dados (Drizzle)
npm run db:generate    # Gera arquivos SQL de migration a partir dos schemas
npm run db:migrate     # Executa as migrations pendentes no banco
npm run db:push        # Sincroniza schemas diretamente com o banco (desenvolvimento)
npm run db:studio      # Abre o Drizzle Studio no navegador para visualização de dados
```

---

## 5. Regras e Convenções Inegociáveis de Código

### 5.1. Idioma e Nomenclatura
- **Código:** Todo o código-fonte deve ser escrito em **Inglês** (nomes de variáveis, funções, classes, métodos, DTOs, interfaces e commits).
- **Mensagens para o Usuário:** Mensagens de erro, respostas de validação do `class-validator` e descrições do Swagger devem ser em **Português (pt-BR)**.
  - *Exemplo:* `@IsNotEmpty({ message: 'O e-mail é obrigatório' })`

### 5.2. Serialização e DTOs de Resposta (`toResponse`)
- **NUNCA** retorne a entidade do banco de dados bruta ou objetos com dados sensíveis (como `password_hash`).
- Utilize `@Expose()` nas propriedades do DTO de resposta e transforme o resultado usando o helper:
  ```typescript
  import { toResponse } from '@/common/serialization/to-response';
  
  // No controller ou service:
  return toResponse(UserResponseDto, userEntity);
  ```

### 5.3. Proteção de Rotas e Decorators Obrigatórios
- Rotas públicas devem ser explícitas com decorators apropriados ou ausência de guards restritivos.
- Rotas autenticadas devem usar `@UseGuards(JwtAuthGuard)` ou o decorator `@Authenticated()`.
- Rotas restritas a administradores da plataforma: `@AdminOnly()`.
- Rotas restritas a organizadores do evento: `@OrgAccess(OrgRole.ADMIN)` ou similar.
- ⚠️ **REGRA CRÍTICA:** Toda vez que um novo endpoint ou controller for criado ou alterado, você **DEVE** adicionar o caso de teste em [`src/auth/route-protection.spec.ts`](src/auth/route-protection.spec.ts) e garantir que o teste passe com `npm run test src/auth/route-protection.spec.ts`.

### 5.4. Testes sem Dependência de Banco Externo
- Os testes unitários e de integração utilizam `@electric-sql/pglite` para simular o PostgreSQL localmente na memória. Não dependa de banco online (Neon) para rodar a suíte padrão de `npm run test`.

---

## 6. Governança Git e Fluxo de Tarefas

1. **Nunca commitar na `develop` ou `main`:**
   - Base do repositório: `develop`.
   - Sempre crie uma branch específica para a issue do YouTrack:
     `git checkout develop && git pull origin develop`
     `git checkout -b <tipo>/GOL-<ID>-<descricao-curta>`
2. **Padrão de Branches:**
   - `feat/GOL-133-busca-eventos`
   - `fix/GOL-112-remapeamento-dtos`
   - `test/GOL-40-testes-entidade-usuario`
3. **Commits Semânticos com ID da Task (Obrigatório pelo Husky/Commitlint):**
   - O padrão rigoroso exigido pelo hook do projeto é: `tipo(GOL-ID): descrição em português`
   - Exemplos válidos:
     - `feat(GOL-133): adiciona filtros por data e categoria na busca`
     - `fix(GOL-112): corrige serializacao dos dtos de login`
     - `test(GOL-40): adiciona testes da entidade usuario`
   - *Nota:* Não use `feat(events): GOL-133 ...`, pois o linter rejeitará. O ID da task DEVE ficar dentro dos parênteses do escopo: `feat(GOL-133): ...`.
4. **Validação Obrigatória Pré-Commit:**
   Antes de comitar ou abrir PR, execute:
   ```bash
   npm run lint && npm run test
   ```
5. **Integração com YouTrack:**
   - Transicione a task para `State In Progress` ao iniciar o desenvolvimento.
   - Atualize para `State Code Review` ao abrir o Pull Request no GitHub apontando para a `develop`.
