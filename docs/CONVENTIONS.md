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
