/**
 * Prueba de carga del Sprint 11: ~1.000 puestos y 100 usuarios simultáneos.
 *
 * Comprueba los objetivos de la sección 46 bajo carga real, no en vacío:
 *   GET map    < 500 ms
 *   check-in   < 500 ms
 *   dashboard  < 1 s
 *
 * Y lo que de verdad importa: que 100 personas peleando por los mismos puestos
 * no produzcan ni una doble ocupación.
 *
 * No es un test de Jest: se ejecuta contra una API ya levantada.
 *   npm run start:dev          (en otra terminal)
 *   npm run test:load
 */
import { PrismaClient, SpaceStatus, UserCategory } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const API = process.env.API_URL ?? 'http://localhost:3001/api/v1';
const USERS = Number(process.env.LOAD_USERS ?? 100);
const PASSWORD = 'CargaUJAP123';

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    'postgresql://ujap_user:ujap_password@localhost:5432/ujap_parking_db?schema=public',
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

interface Medicion {
  ms: number;
  status: number;
}

/** Percentil por interpolación simple sobre la muestra ordenada. */
function percentil(valores: number[], p: number): number {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const index = Math.min(
    ordenados.length - 1,
    Math.floor((p / 100) * ordenados.length),
  );
  return Math.round(ordenados[index]);
}

function resumen(nombre: string, medidas: Medicion[], objetivoMs: number) {
  const ms = medidas.map((m) => m.ms);
  const p50 = percentil(ms, 50);
  const p95 = percentil(ms, 95);
  const max = Math.round(Math.max(...ms));
  const cumple = p95 <= objetivoMs;

  console.log(
    `  ${cumple ? '✅' : '❌'} ${nombre.padEnd(22)} p50 ${String(p50).padStart(5)} ms · p95 ${String(p95).padStart(5)} ms · max ${String(max).padStart(5)} ms   (objetivo p95 < ${objetivoMs} ms)`,
  );

  return cumple;
}

async function medir(url: string, init: RequestInit = {}): Promise<Medicion> {
  const t0 = performance.now();
  const res = await fetch(url, init);
  await res.text();
  return { ms: performance.now() - t0, status: res.status };
}

async function main() {
  console.log(`\n🔬 Prueba de carga — ${USERS} usuarios simultáneos\n`);

  // ── Preparar usuarios de carga ────────────────────────────
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const emails = Array.from(
    { length: USERS },
    (_, i) => `carga${i}@ujap.edu.ve`,
  );

  for (const email of emails) {
    await prisma.user.upsert({
      where: { email },
      update: { passwordHash, category: UserCategory.STUDENT },
      create: {
        firstName: 'Carga',
        lastName: email,
        email,
        passwordHash,
        category: UserCategory.STUDENT,
      },
    });
  }

  const userIds = (
    await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true },
    })
  ).map((u) => u.id);

  // Estado limpio: sin sesiones previas de estos usuarios
  await prisma.parkingSession.deleteMany({
    where: { userId: { in: userIds } },
  });

  const login = async (email: string, password = PASSWORD) => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const body = (await res.json()) as { data?: { accessToken?: string } };
    if (!body.data?.accessToken) {
      throw new Error(`Login falló para ${email}: HTTP ${res.status}`);
    }
    return body.data.accessToken;
  };

  console.log('Autenticando…');
  const tokens: string[] = [];
  // Secuencial: el login lleva bcrypt y saturarlo mediría el hash, no la API
  for (const email of emails) tokens.push(await login(email));

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  let ok = true;

  // ── 1. Mapa bajo carga ────────────────────────────────────
  console.log('\n1. GET /parking-spaces/map con todos a la vez');
  const mapas = await Promise.all(
    tokens.map((t) => medir(`${API}/parking-spaces/map`, { headers: auth(t) })),
  );
  ok = resumen('mapa (~1.000 puestos)', mapas, 500) && ok;

  // ── 2. Dashboard bajo carga ───────────────────────────────
  console.log('\n2. GET /dashboard/summary');
  const adminPassword = process.env.LOAD_ADMIN_PASSWORD ?? 'Admin1234!';
  const admin = await login('admin@ujap.edu.ve', adminPassword);
  const dashboards = await Promise.all(
    Array.from({ length: 20 }, () =>
      medir(`${API}/dashboard/summary`, { headers: auth(admin) }),
    ),
  );
  ok = resumen('dashboard', dashboards, 1000) && ok;

  // ── 3. Todos contra el MISMO puesto ───────────────────────
  console.log(`\n3. Los ${USERS} sobre un mismo puesto (sección 25)`);
  const disputado = await prisma.parkingSpace.findUniqueOrThrow({
    where: { code: 'A-100' },
  });
  await prisma.parkingSession.deleteMany({
    where: { parkingSpaceId: disputado.id },
  });
  await prisma.parkingSpace.update({
    where: { id: disputado.id },
    data: { status: SpaceStatus.AVAILABLE },
  });

  const disputa = await Promise.all(
    tokens.map((t) =>
      medir(`${API}/parking-sessions/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth(t) },
        body: JSON.stringify({ parkingSpaceId: disputado.id }),
      }),
    ),
  );

  const ganadores = disputa.filter((m) => m.status === 201).length;
  const rechazados = disputa.filter((m) => m.status === 409).length;
  const inesperados = disputa.filter(
    (m) => m.status !== 201 && m.status !== 409,
  );

  console.log(
    `     ganadores: ${ganadores} · rechazados con 409: ${rechazados}`,
  );
  if (inesperados.length > 0) {
    console.log(
      `     ⚠️  respuestas inesperadas: ${[...new Set(inesperados.map((m) => m.status))].join(', ')}`,
    );
  }

  const sesionesDelPuesto = await prisma.parkingSession.count({
    where: { parkingSpaceId: disputado.id, status: 'ACTIVE' },
  });

  const sinDobleOcupacion = ganadores === 1 && sesionesDelPuesto === 1;
  console.log(
    `  ${sinDobleOcupacion ? '✅' : '❌'} exactamente una ocupación (RN-001)`,
  );
  ok = sinDobleOcupacion && ok;

  // ── 4. Check-in en puestos distintos ──────────────────────
  console.log(`\n4. Los ${USERS} sobre puestos DISTINTOS`);
  await prisma.parkingSession.deleteMany({
    where: { userId: { in: userIds } },
  });

  const libres = await prisma.parkingSpace.findMany({
    where: {
      status: SpaceStatus.AVAILABLE,
      zone: { code: { in: ['B', 'C'] } },
    },
    take: USERS,
    select: { id: true },
  });

  const checkIns = await Promise.all(
    tokens.slice(0, libres.length).map((t, i) =>
      medir(`${API}/parking-sessions/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth(t) },
        body: JSON.stringify({ parkingSpaceId: libres[i].id }),
      }),
    ),
  );

  ok = resumen('check-in', checkIns, 500) && ok;
  const creados = checkIns.filter((m) => m.status === 201).length;
  console.log(`     sesiones creadas: ${creados} de ${libres.length}`);
  ok = creados === libres.length && ok;

  // ── Limpieza ──────────────────────────────────────────────
  console.log('\nLimpiando…');
  const ocupados = await prisma.parkingSession.findMany({
    where: { userId: { in: userIds }, status: 'ACTIVE' },
    select: { parkingSpaceId: true },
  });
  await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.parkingSession.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.parkingSpace.updateMany({
    where: { id: { in: ocupados.map((s) => s.parkingSpaceId) } },
    data: { status: SpaceStatus.AVAILABLE },
  });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });

  console.log(
    ok
      ? '\n✅ Todos los objetivos de la sección 46 se cumplen bajo carga\n'
      : '\n❌ Algún objetivo no se cumple — revisar arriba\n',
  );

  await prisma.$disconnect();
  await pool.end();
  process.exit(ok ? 0 : 1);
}

void main();
