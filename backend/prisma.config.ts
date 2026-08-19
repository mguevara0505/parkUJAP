import { defineConfig } from 'prisma/config';

/**
 * Prisma 7+ — Configuración mínima para CLI (migrate, generate, studio).
 * El driver adapter (PrismaPg) se configura en PrismaService para el runtime.
 * Ref: https://pris.ly/d/config-datasource
 */
export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://ujap_user:ujap_password@localhost:5432/ujap_parking_db?schema=public',
  },
});
