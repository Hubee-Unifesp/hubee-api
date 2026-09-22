/**
 * Índice do schema do Drizzle.
 *
 * Cada tabela vive em seu próprio arquivo dentro desta pasta e é reexportada
 * aqui. O `drizzle-kit` lê este arquivo para gerar as migrations, e o client
 * usa o mesmo objeto para tipar as queries.
 */
export * from './user';
export * from './order.schema';
export * from './event.schema';
export * from './task.schema';
export * from './address.schema';
export * from './venue.schema';
export * from './organization-user';
export * from './organization-event.schema';
export * from './fornecedor';
export * from './organization.schema';
