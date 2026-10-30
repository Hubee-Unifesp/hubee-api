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

## Compra, checkout e ingressos

Regras da GOL-175 que atravessam `orders`, `payments` e `tickets`:

- `POST /orders` recebe `items` (`ticketTypeId` e `quantity`); o **total é
  sempre calculado no servidor** a partir do preço atual do lote, e o preço
  fica gravado em `order_items.unit_price`.
- O saldo de um lote é `ticket_types.quantity` menos os itens de pedidos
  `pendente` e `pago`: pedido pendente reserva o estoque e cancelar devolve.
  Lote esgotado ou quantidade acima do saldo responde `422`.
- Pedido e itens são gravados numa transação, com os lotes travados
  (`FOR UPDATE`). Quem precisar de várias escritas atômicas passa o `tx` aos
  repositories pelo parâmetro `executor`.
- `POST /payments` paga o total do pedido e, **na mesma transação**, passa o
  pedido para `pago` e emite os ingressos (um por unidade, `qr_code` aleatório
  de 64 caracteres). Ingresso só é emitido para pedido `pago`.

## Autenticação e autorização

As rotas usam JWT (`Authorization: Bearer <token>`, obtido em `POST /auth/login`
ou `POST /auth/register`). A regra base veio da task **GOL-114**; o modelo de
permissões por organização (spike **GOL-109**) já vale para eventos
(**GOL-144**) e ainda vai chegar aos demais recursos de organizador:

| Recurso | Leitura (`GET`) | Escrita (`POST`/`PATCH`/`DELETE`) |
| ------- | --------------- | --------------------------------- |
| `events` | pública, mas só `ADMIN` e membros da organização do evento veem eventos não publicados: para os demais o filtro `?status=` é ignorado e `GET /events/:id` de evento não publicado dá `404`. O membro vê os rascunhos filtrando por `?organizerId=` da sua organização | `ADMIN` ou membro com `write` na organização (`POST`: a do `organizerId` do body; `PATCH`: a dona do evento, e quem é de fora recebe `404`). Cancelar (`DELETE` ou `PATCH` com `status: cancelled`) exige `manage` (administrador da organização). `featured` (destaque na home) só `ADMIN` |
| `events/:eventId/ticket-types`, `organizations`, `venues` | pública (a home usa sem login) | só `ADMIN` |
| `suppliers`, `expenses`, `tasks`, `organization-users`, `organization-events` | só `ADMIN` | só `ADMIN` |
| `orders/:orderId/payments` | dono do pedido ou `ADMIN` | só `ADMIN` (`POST` registra pagamento à mão e `PATCH` muda o status: o body aceita `amount` e `status`, e confirmar o pagamento libera ingressos) |
| `payments` (checkout) | não tem | `POST /payments`: qualquer usuário logado paga o **próprio** pedido pendente (pedido de outra pessoa responde `404`, pedido já pago ou cancelado `422`) |
| `tickets` | `GET /tickets` e `GET /users/me/tickets`: só os ingressos em que o usuário é titular, inclusive para `ADMIN`. `GET /tickets/:id` e `GET /orders/:orderId/tickets`: titular, dono do pedido ou `ADMIN` | só `ADMIN` (emissão manual e mudança de status) |
| `orders` | ver GOL-103 | `POST /orders`: qualquer usuário logado com perfil completo; `PATCH` (status): só `ADMIN`; demais, ver GOL-103 |
| `users` | ver GOL-105 | ver GOL-105 |

Continuam públicos `POST /auth/login`, `POST /auth/register` e `GET /health`.
Recurso de outra pessoa responde **`404`** (e não `403`), para não revelar
quais ids existem.

- Para restringir a ADMIN, use o decorator
  [`@AdminOnly()`](../src/auth/decorators/admin-only.decorator.ts), na rota ou
  no controller inteiro. Ele aplica `JwtAuthGuard` + `RolesGuard` e documenta o
  Bearer e as respostas `401`/`403` no Swagger.
- Para restringir a membros de uma organização, use
  [`@OrgAccess(level, source)`](../src/auth/decorators/org-access.decorator.ts).
  Os níveis são cumulativos: `read` (qualquer membro com convite aceito),
  `write` (`permission = full`) e `manage` (`role = admin` com `permission = full`;
  `admin` com `read_only` fica em `read`). O `ADMIN` global
  passa sempre. Com `source` `{ from: 'event' }`, quem não é membro da
  organização do evento recebe `404`; nas outras origens, `403`. As
  organizações do usuário logado saem em `GET /users/me` (`organizations`, com
  o `level` de cada uma).
- Para exigir só login (qualquer role), use
  [`@Authenticated()`](../src/auth/decorators/authenticated.decorator.ts) e
  confira o dono no service com
  [`canAccess()`](../src/auth/ownership.ts) e `@CurrentUser()`.
- Rota pública que mostra mais para ADMIN usa
  [`OptionalJwtAuthGuard`](../src/auth/guards/optional-jwt-auth.guard.ts): sem
  `Authorization` segue anônima, com token inválido dá `401`.
- Sem token (ou com token inválido/expirado) a resposta é **`401`**; com token
  válido sem a role exigida, **`403`**.
- O teste [`route-protection.spec.ts`](../src/auth/route-protection.spec.ts)
  lê as rotas direto dos controllers: **toda rota nova é tratada como só ADMIN**
  e o teste falha se ela não estiver protegida. Para tornar uma rota pública,
  adicione-a a `PUBLIC_ROUTES` nesse teste; para liberar a qualquer usuário
  logado, a `AUTHENTICATED_ROUTES`; para liberar a organizadores com
  `@OrgAccess('write')`, a `ORGANIZER_WRITE_ROUTES`, e com
  `@OrgAccess('manage')`, a `ORGANIZER_MANAGE_ROUTES`.

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
