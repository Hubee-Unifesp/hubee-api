# Atualização de locais e troca de endereço

Este documento descreve o comportamento atual de `PATCH /locais/:id` em
`VenueService.update` e as decisões pendentes identificadas na revisão do PR.

## Identidade do local e vínculo dos eventos

Sem alteração de endereço, o serviço atualiza o próprio local. Quando o payload
contém `addressId` ou `address`, o serviço resolve o endereço e procura um local
ativo com o nome, a capacidade e o endereço resultantes:

- Se encontrar outro local e `active` não for `false`, desativa o local original
  e retorna o local encontrado.
- Caso contrário, se o endereço resolvido mantiver o mesmo ID, atualiza o local
  original, preservando seu ID.
- Se o ID do endereço mudar, cria um local, desativa o original e retorna o novo
  registro. Essas operações ocorrem na mesma transação.

Portanto, o ID retornado pelo PATCH pode ser diferente do ID da URL. Por exemplo,
a troca do endereço de um local A pode retornar um local B e deixar A inativo.
Os eventos vinculados a A continuam com `events.venue_id = A`, inclusive eventos
futuros: o fluxo não migra esses vínculos para B.

A FK de `events.venue_id` usa `ON DELETE RESTRICT`, impedindo a exclusão de um
local referenciado. Ela não impede sua desativação nem transfere os eventos
para outro registro.

Esse fluxo preserva o local e o endereço anteriores para os eventos já
vinculados. Isso, por si só, não define uma política completa de histórico:
não há neste fluxo um vínculo explícito entre a versão anterior e a nova, e
alterações sem troca de endereço continuam modificando o registro original.
É necessário confirmar se preservar esses vínculos é a regra de negócio
pretendida. Se a identidade do local deve permanecer estável na troca de
endereço, a alternativa é atualizar o `addressId` do próprio local; nesse caso,
os eventos vinculados passam a consultar o endereço atualizado.

## Listagem de locais inativos

`VenueRepository.findAll`, usado por `GET /locais`, filtra apenas cidade e
estado. Não aplica filtro de `active`. Assim, o local antigo inativo e o novo
podem aparecer juntos na listagem, desde que ambos atendam aos filtros.

A desativação não equivale a ocultar o registro. Se a listagem deve exibir apenas
locais disponíveis, será necessário definir e implementar o filtro de ativos
e como os registros históricos serão consultados.

## Troca de endereço com `active: false`

Quando o endereço resolvido tem outro ID e o payload contém `active: false`,
o serviço não reutiliza outro local ativo: cria um local já inativo e também
desativa o original. O PATCH retorna o novo registro inativo.

Esse é o comportamento atual, mas sua adequação à regra de negócio permanece
pendente. É preciso definir se essa combinação deve ser rejeitada, se deve
apenas desativar o local original ou se deve manter a criação de outro registro
inativo. Enviar somente `active: false`, sem endereço, desativa o local original
sem criar outro.

## Referências da implementação

- [VenueService.update](../src/venue/venue.service.ts)
- [VenueRepository.findAll](../src/venue/venue.repository.ts)
- [FK dos eventos](../src/database/schema/event.schema.ts)
