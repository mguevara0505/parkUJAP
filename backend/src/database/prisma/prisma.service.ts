import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private pool: Pool;

  constructor() {
    const connectionString =
      process.env.DATABASE_URL ??
      'postgresql://ujap_user:ujap_password@localhost:5432/ujap_parking_db?schema=public';

    /**
     * `pg` trae 10 conexiones por defecto. Con los 100 usuarios simultáneos
     * que exige la sección 11, las peticiones se serializaban de diez en diez
     * y el check-in se iba por encima del objetivo de 500 ms de la sección 46.
     *
     * 25 es holgado para este tamaño y sigue muy por debajo del
     * `max_connections` de PostgreSQL (100 por defecto), que hay que repartir
     * entre todas las instancias de la API.
     */
    const poolSize = Number(process.env.DATABASE_POOL_SIZE ?? 25);

    const pool = new Pool({ connectionString, max: poolSize });
    const adapter = new PrismaPg(pool);

    super({ adapter });

    // Guardamos referencia al pool para cerrarlo en destroy
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('✅ Conectado a PostgreSQL via Prisma + PrismaPg adapter');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
    this.logger.log('Desconectado de PostgreSQL');
  }
}

// Aquí vivía cleanDatabase(): un TRUNCATE de todas las tablas «solo para
// tests». No la llamaba nadie, y como los e2e corren contra la misma base que
// el desarrollo, la única forma de usarla era borrar el seed por accidente.
// Los e2e limpian lo suyo con los helpers de test/e2e-helpers.ts.
