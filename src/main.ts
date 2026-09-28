import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3001').split(','),
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Hubee API')
    .setDescription(
      'API do Hubee — plataforma de planejamento e venda de eventos online.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);

  // Documenta o formato de erro padrão do Nest em todas as operações, para que
  // a resposta de erro fique explícita no OpenAPI (parte do escopo da task).
  document.components ??= {};
  document.components.schemas ??= {};
  document.components.schemas.ErrorResponse = {
    type: 'object',
    properties: {
      statusCode: { type: 'number', example: 400 },
      message: {
        oneOf: [
          { type: 'string' },
          { type: 'array', items: { type: 'string' } },
        ],
      },
      error: { type: 'string', example: 'Bad Request' },
    },
  };
  const errorContent = {
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  };
  const methods = ['get', 'post', 'put', 'patch', 'delete'] as const;
  for (const [path, item] of Object.entries(document.paths)) {
    for (const method of methods) {
      const operation = item[method];
      if (!operation) continue;
      operation.responses['400'] ??= {
        description: 'Requisição inválida (falha de validação do payload).',
        ...errorContent,
      };
      if (path.includes('{')) {
        operation.responses['404'] ??= {
          description: 'Recurso não encontrado.',
          ...errorContent,
        };
      }
    }
  }

  SwaggerModule.setup('docs', app, document);

  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
