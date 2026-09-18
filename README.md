# Hubee API

API do Hubee, uma plataforma para planejamento e venda de eventos online. Desenvolvido por alunos da unifesp.

Este é um projeto acadêmico desenvolvido para a disciplina de **Engenharia de Software**. A proposta é permitir que organizadores criem e gerenciem eventos, enquanto participantes encontram eventos e compram ingressos pela plataforma.

## Funcionalidades previstas

- Cadastro e gerenciamento de eventos
- Divulgação de eventos online
- Venda de ingressos
- Gerenciamento de participantes

## Tecnologias

- Node.js
- TypeScript
- NestJS
- PostgreSQL (Neon)
- Drizzle ORM

## Como executar

### Pré-requisitos

- Node.js instalado
- npm instalado
- Acesso a um banco PostgreSQL (projeto no Neon ou Postgres local)

### Instalação

```bash
npm install
```

### Variáveis de ambiente

```bash
cp .env.example .env
```

Preencha o `.env` com os dados de conexão do banco:

| Variável      | Descrição                                                   |
| ------------- | ----------------------------------------------------------- |
| `PORT`        | Porta da API (padrão `3000`)                                |
| `DB_HOST`     | Host do Postgres                                            |
| `DB_PORT`     | Porta do Postgres (padrão `5432`)                           |
| `DB_USER`     | Usuário                                                     |
| `DB_PASSWORD` | Senha                                                       |
| `DB_NAME`     | Nome do banco                                               |
| `DB_SSL`      | `true` para o Neon (exige TLS), `false` para Postgres local |

No Neon, esses valores estão em **Dashboard > Connect > Parameters only**.

A aplicação valida as variáveis no boot: se alguma estiver faltando ou for
inválida, a API não sobe e o erro aponta qual é.

### Executar em desenvolvimento

```bash
npm run start:dev
```

A aplicação será iniciada em `http://localhost:3000`.

### Verificar a conexão com o banco

```bash
curl http://localhost:3000/health
```

O endpoint executa um `select 1` no Postgres através do Drizzle. Com a conexão
saudável, a resposta é:

```json
{ "status": "ok", "database": { "status": "up", "latencyMs": 42 } }
```

Se o banco estiver inacessível, responde `503` com o motivo da falha.

## Banco de dados

O acesso a dados usa [Drizzle ORM](https://orm.drizzle.team) sobre o driver
`node-postgres`, o que permite apontar tanto para o Neon quanto para um
Postgres local sem mudar código.

- `src/database/schema/` — definição das tabelas (o `index.ts` é o ponto de
  entrada lido pelo `drizzle-kit`)
- `src/database/migrations/` — migrations geradas
- `src/database/database.module.ts` — módulo global que expõe o client pelo
  token `DRIZZLE`

Para usar o client em um service:

```ts
constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}
```

### Comandos do Drizzle

| Comando               | O que faz                                       |
| --------------------- | ----------------------------------------------- |
| `npm run db:generate` | Gera migrations a partir do schema              |
| `npm run db:migrate`  | Aplica as migrations pendentes no banco         |
| `npm run db:push`     | Sincroniza o schema direto no banco (só em dev) |
| `npm run db:studio`   | Abre o Drizzle Studio para inspecionar os dados |

## Testes

```bash
npm run test
```

## Status

Projeto em desenvolvimento.
