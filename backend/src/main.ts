import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { AuditService } from './modules/audit/audit.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Prefijo global de API
  app.setGlobalPrefix('api/v1');

  // Seguridad
  app.use(helmet());
  app.use(cookieParser());

  // CORS
  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN', 'http://localhost:3000'),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Validación global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Filtros e interceptores globales
  app.useGlobalFilters(new HttpExceptionFilter());
  // El primero registrado es el más externo, así que el de auditoría recibe la
  // respuesta ya envuelta en { success, data }. Su extractor de id contempla
  // las dos formas, con envoltorio y sin él.
  app.useGlobalInterceptors(
    new AuditInterceptor(app.get(AuditService)),
    new ResponseInterceptor(),
  );

  // Swagger / OpenAPI
  const swaggerConfig = new DocumentBuilder()
    .setTitle('UJAP Parking API')
    .setDescription(
      'Sistema de Gestión y Reserva de Estacionamientos — Universidad José Antonio Páez',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addTag('Auth', 'Autenticación y sesión')
    .addTag('Users', 'Gestión de usuarios')
    .addTag('Parking Lots', 'Estacionamientos físicos')
    .addTag('Parking Zones', 'Zonas de estacionamiento')
    .addTag('Parking Spaces', 'Puestos individuales')
    .addTag('Parking Sessions', 'Registro de ocupación')
    .addTag('Reservations', 'Reservas administrativas')
    .addTag('Visitors', 'Visitantes externos')
    .addTag('Maintenance', 'Bloqueos y mantenimiento')
    .addTag('Dashboard', 'Estadísticas y KPIs')
    .addTag('Audit', 'Registro de auditoría')
    .addTag('Health', 'Estado del sistema')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/v1/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
    },
  });

  const port = config.get<number>('PORT', 3001);
  await app.listen(port);

  logger.log(
    `🚀 UJAP Parking API corriendo en: http://localhost:${port}/api/v1`,
  );
  logger.log(`📚 Swagger disponible en: http://localhost:${port}/api/v1/docs`);
}

void bootstrap();
