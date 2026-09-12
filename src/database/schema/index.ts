/**
 * Índice do schema do Drizzle.
 *
 * Cada tabela vive em seu próprio arquivo dentro desta pasta e é reexportada
 * aqui. O `drizzle-kit` lê este arquivo para gerar as migrations, e o client
 * usa o mesmo objeto para tipar as queries.
 *
 * Ainda não há tabelas: elas chegam nas tasks de modelagem de dados.
 */
export * from './usuario';
export * from './address.schema';
export * from './venue.schema';
