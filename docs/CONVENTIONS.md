# Convenções da API (hubee-api)

Este documento registra as convenções de nomenclatura e o padrão de respostas
da API, adotados na task **GOL-82**. Vale para todo código novo no repositório.

## Idioma / nomenclatura

A camada de código e a interface pública da API são em **inglês**:

- Pastas, arquivos, classes, DTOs, propriedades e **rotas** em inglês.
- Identificadores em `camelCase` (variáveis/métodos/propriedades) e `PascalCase`
  (classes/tipos), como de praxe em TypeScript.

### Exceções (mantidas em português)

Por decisão consciente, estes pontos **permanecem em português** e não devem ser
"traduzidos":

- **Termos de domínio brasileiros**: `cpf`, `cnpjCpf` (documentos fiscais BR).
- **Mensagens voltadas ao usuário** (exceptions e mensagens de validação): são
  conteúdo de produto exibido ao usuário final. Ex.: `"Fornecedor não encontrado."`,
  `"O primeiro nome é obrigatório"`.
- **Valores de enum gravados no banco**: ex. `pendente`, `pago`, `cartao_credito`,
  `estornado`. Mantidos por enquanto porque estão persistidos no banco; a
  padronização deles depende da migração de banco (ver "Banco de dados" abaixo).

### Rotas (URLs)

- Recursos no **plural** e em **kebab-case**: `users`, `suppliers`, `ticket-types`,
  `organization-users`.
- Sub-recursos aninhados sob o recurso pai: `events/:eventId/expenses`,
  `orders/:orderId/payments`, `organizations/:orgId/users`.

## Padrão de respostas

| Verbo | Sucesso | Corpo |
| ----- | ------- | ----- |
| `POST` (create) | `201 Created` | o recurso criado |
| `GET` (findAll/findOne) | `200 OK` | o(s) recurso(s) |
| `PATCH` (update) | `200 OK` | o recurso atualizado |
| `DELETE` (remove) | `204 No Content` | **sem corpo** |

- **Consistência de payload**: uma resposta de `create`/`update` de um recurso
  deve ter o **mesmo formato** da resposta do `GET` dele (ex.: `venue` retorna o
  `address` aninhado em GET, create e update).
- **Erros**: seguem o formato padrão do NestJS —
  `{ statusCode, message, error }`. `400` para falha de validação de payload,
  `404` para recurso inexistente, `409` para conflito de estado. Estão
  documentados no OpenAPI.

### DTOs de resposta

Cada recurso tem um `*ResponseDto` explícito (ex.: `SupplierResponseDto`) que
define o contrato de saída público — omitindo campos internos como `deletedAt`
e `password`. Esses DTOs são referenciados nos controllers via
`@ApiOkResponse`/`@ApiCreatedResponse`, então o Swagger mostra o schema real da
resposta.

O contrato também é aplicado em **runtime** (task **GOL-112**):

- Os services retornam a linha do banco; o **controller** converte o retorno com
  `toResponse(XResponseDto, ...)` ([`src/common/serialization/to-response.ts`](../src/common/serialization/to-response.ts)),
  que usa `plainToInstance` com `excludeExtraneousValues`.
- Todo campo do DTO precisa de **`@Expose()`** junto do `@ApiProperty()`; campo
  sem `@Expose()` não sai na resposta. Objetos aninhados também precisam de
  `@Type(() => OutroResponseDto)` (ex.: `VenueResponseDto.address`).
- O teste de contrato em
  [`to-response.spec.ts`](../src/common/serialization/to-response.spec.ts)
  garante que cada `*ResponseDto` expõe exatamente as propriedades documentadas
  no OpenAPI. Ao criar um DTO de resposta novo, adicione-o à lista desse teste.

## Autenticação e autorização

As rotas usam JWT (`Authorization: Bearer <token>`, obtido em `POST /auth/login`
ou `POST /auth/register`). A regra atual (task **GOL-114**) é **provisória**,
até o spike **GOL-109** definir as permissões por organização:

| Recurso | Leitura (`GET`) | Escrita (`POST`/`PATCH`/`DELETE`) |
| ------- | --------------- | --------------------------------- |
| `events`, `events/:eventId/ticket-types`, `organizations`, `venues` | pública (a home usa sem login) | só `ADMIN` |
| `suppliers`, `expenses`, `tasks`, `payments`, `organization-users`, `organization-events` | só `ADMIN` | só `ADMIN` |
| `users` | ver GOL-105 | ver GOL-105 |
| `orders`, `tickets` | ver GOL-103 | ver GOL-103 |

Continuam públicos `POST /auth/login`, `POST /auth/register` e `GET /health`.

- Para restringir a ADMIN, use o decorator
  [`@AdminOnly()`](../src/auth/decorators/admin-only.decorator.ts), na rota ou
  no controller inteiro. Ele aplica `JwtAuthGuard` + `RolesGuard` e documenta o
  Bearer e as respostas `401`/`403` no Swagger.
- Sem token (ou com token inválido/expirado) a resposta é **`401`**; com token
  válido sem a role exigida, **`403`**.
- O teste [`route-protection.spec.ts`](../src/auth/route-protection.spec.ts)
  lê as rotas direto dos controllers: **toda rota nova é tratada como só ADMIN**
  e o teste falha se ela não estiver protegida. Para tornar uma rota pública,
  adicione-a a `PUBLIC_ROUTES` nesse teste.

## Documentação (OpenAPI / Swagger)

A documentação é **gerada a partir do código** (tipos dos DTOs + decorators) e
publicada quando a aplicação sobe:

- **Swagger UI**: `GET /docs` — página interativa para explorar e testar.
- **Spec OpenAPI (JSON)**: `GET /docs-json`.

Configuração: plugin em [`nest-cli.json`](../nest-cli.json), setup em
[`src/main.ts`](../src/main.ts) e `@ApiTags` nos controllers.

## Compatibilidade com produção

Na data desta padronização, a API **não estava em produção** com consumidores
externos. Por isso as rotas e os identificadores foram renomeados livremente,
**sem** manter aliases de compatibilidade. Mudanças futuras de contrato, uma vez
que houver consumidores, devem considerar versionamento/compatibilidade.

## Banco de dados

A padronização atual é **apenas na camada de código/API**. O Drizzle mapeia os
identificadores TS (em inglês) para as strings originais do banco, então **os
nomes no banco não mudaram**. A padronização do próprio banco é uma **task
futura** e exigirá migrations para:

- Renomear a tabela `pagamentos` → `payments`.
- Renomear a coluna `expenses.fornecedor_id` → `supplier_id`.
- Renomear o enum Postgres `despesa_payment_status` → `expense_payment_status`.
- Renomear a check constraint `pagamentos_amount_non_negative` →
  `payments_amount_non_negative`.
- Traduzir os **valores** de enum persistidos (`pendente`, `cartao_credito`,
  `estornado`, ...), o que exige `UPDATE` dos dados existentes e ajuste do
  `pgEnum`, das validações nos DTOs e do mapa `VALID_STATUS_TRANSITIONS` em
  `payment.service.ts`.
