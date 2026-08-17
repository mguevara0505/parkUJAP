import { PrismaClient, Role, SpaceType, UserStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://ujap_user:ujap_password@localhost:5432/ujap_parking_db?schema=public';

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const BCRYPT_ROUNDS = 12;

async function main() {
  console.log('🌱 Iniciando seed de UJAP Parking...\n');

  // ────────────────────────────────────────────
  // 1. ADMINISTRADOR
  // ────────────────────────────────────────────
  const adminPasswordHash = await bcrypt.hash('Admin1234!', BCRYPT_ROUNDS);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@ujap.edu.ve' },
    update: {},
    create: {
      firstName: 'Administrador',
      lastName: 'UJAP',
      email: 'admin@ujap.edu.ve',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      universityId: 'ADMIN-001',
      documentId: 'V-00000001',
      phone: '+58412-0000000',
    },
  });

  console.log(`✅ Admin creado: ${admin.email}`);

  // ────────────────────────────────────────────
  // 2. USUARIOS REGULARES (20 usuarios)
  // ────────────────────────────────────────────
  const userPasswordHash = await bcrypt.hash('User1234!', BCRYPT_ROUNDS);

  const userNames = [
    { firstName: 'Carlos', lastName: 'Rodríguez', universityId: '2023-001' },
    { firstName: 'María', lastName: 'González', universityId: '2023-002' },
    { firstName: 'Luis', lastName: 'Martínez', universityId: '2023-003' },
    { firstName: 'Ana', lastName: 'López', universityId: '2023-004' },
    { firstName: 'Pedro', lastName: 'García', universityId: '2023-005' },
    { firstName: 'Laura', lastName: 'Hernández', universityId: '2023-006' },
    { firstName: 'José', lastName: 'Díaz', universityId: '2023-007' },
    { firstName: 'Sofía', lastName: 'Fernández', universityId: '2023-008' },
    { firstName: 'Miguel', lastName: 'Torres', universityId: '2023-009' },
    { firstName: 'Valentina', lastName: 'Vargas', universityId: '2023-010' },
    { firstName: 'Andrés', lastName: 'Jiménez', universityId: '2024-001' },
    { firstName: 'Isabella', lastName: 'Morales', universityId: '2024-002' },
    { firstName: 'Diego', lastName: 'Castillo', universityId: '2024-003' },
    { firstName: 'Camila', lastName: 'Romero', universityId: '2024-004' },
    { firstName: 'Sebastián', lastName: 'Flores', universityId: '2024-005' },
    { firstName: 'Gabriela', lastName: 'Reyes', universityId: '2024-006' },
    { firstName: 'Alejandro', lastName: 'Cruz', universityId: '2024-007' },
    { firstName: 'Daniela', lastName: 'Mora', universityId: '2024-008' },
    { firstName: 'Ricardo', lastName: 'Sánchez', universityId: '2024-009' },
    { firstName: 'Mariana', lastName: 'Gutiérrez', universityId: '2024-010' },
  ];

  for (const u of userNames) {
    const email = `${u.firstName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')}.${
      u.lastName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(' ')[0]
    }@ujap.edu.ve`;

    await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        firstName: u.firstName,
        lastName: u.lastName,
        email,
        passwordHash: userPasswordHash,
        role: Role.USER,
        status: UserStatus.ACTIVE,
        universityId: u.universityId,
      },
    });

    process.stdout.write(`  👤 ${u.firstName} ${u.lastName} → ${email}\n`);
  }

  console.log('\n✅ 20 usuarios creados\n');

  // ────────────────────────────────────────────
  // 3. ESTACIONAMIENTO (sección 8.2)
  // ────────────────────────────────────────────
  const lot = await prisma.parkingLot.upsert({
    where: { code: 'PRINCIPAL' },
    update: {},
    create: {
      name: 'Estacionamiento Principal',
      code: 'PRINCIPAL',
      description:
        'Estacionamiento principal de la Universidad José Antonio Páez',
      location: 'Av. Universidad, entrada principal',
    },
  });

  console.log(`✅ Estacionamiento creado: ${lot.code} — ${lot.name}`);

  // ────────────────────────────────────────────
  // 4. ZONAS (sección 8.3) — 10 zonas, códigos A..J
  // ────────────────────────────────────────────
  // `type` y `priority` describen el carácter de cada zona (secciones 8.4 y 17)
  const zones = [
    {
      code: 'A',
      name: 'Zona A',
      description: 'Cercana al edificio principal',
      type: SpaceType.STANDARD,
      priority: 2,
      isCovered: false,
    },
    {
      code: 'B',
      name: 'Zona B',
      description: 'Frente a la biblioteca',
      type: SpaceType.STANDARD,
      priority: 3,
      isCovered: false,
    },
    {
      code: 'C',
      name: 'Zona C',
      description: 'Lateral este',
      type: SpaceType.STANDARD,
      priority: 3,
      isCovered: false,
    },
    {
      code: 'D',
      name: 'Zona D',
      description: 'Lateral oeste',
      type: SpaceType.STANDARD,
      priority: 4,
      isCovered: false,
    },
    {
      code: 'E',
      name: 'Zona E',
      description: 'Área deportiva',
      type: SpaceType.STANDARD,
      priority: 4,
      isCovered: false,
    },
    {
      code: 'F',
      name: 'Zona F',
      description: 'Zona techada',
      type: SpaceType.STANDARD,
      priority: 2,
      isCovered: true,
    },
    {
      code: 'G',
      name: 'Zona G',
      description: 'Zona de profesores',
      type: SpaceType.PROFESSOR,
      priority: 2,
      isCovered: false,
    },
    {
      code: 'H',
      name: 'Zona H',
      description: 'Zona administrativa',
      type: SpaceType.STAFF,
      priority: 3,
      isCovered: false,
    },
    {
      code: 'I',
      name: 'Zona I',
      description: 'Zona de visitantes',
      type: SpaceType.VISITOR,
      priority: 2,
      isCovered: false,
    },
    {
      code: 'J',
      name: 'Zona J',
      description: 'Zona VIP y autoridades',
      type: SpaceType.VIP,
      priority: 1,
      isCovered: true,
    },
  ];

  const zoneIds = new Map<string, string>();

  for (const [index, zone] of zones.entries()) {
    const created = await prisma.parkingZone.upsert({
      where: { code: zone.code },
      update: {},
      create: {
        code: zone.code,
        name: zone.name,
        description: zone.description,
        parkingLotId: lot.id,
        floor: 1,
        sortOrder: index + 1,
      },
    });

    zoneIds.set(zone.code, created.id);
    process.stdout.write(`  🅿️  ${zone.code} → ${zone.name}\n`);
  }

  console.log('\n✅ 10 zonas creadas\n');

  // ────────────────────────────────────────────
  // 5. PUESTOS (sección 8.4) — 100 por zona ≈ 1.000
  //    Geometría de la sección 19: cada zona es una cuadrícula de 20×5 con
  //    un pasillo de circulación entre filas. Las coordenadas son absolutas
  //    dentro del plano del estacionamiento, para dibujarlas en un solo SVG.
  // ────────────────────────────────────────────
  const SPACES_PER_ZONE = 100;
  const COLS = 20;
  const SPACE_W = 60;
  const SPACE_H = 100;
  const GAP_X = 12; // separación entre puestos contiguos
  const AISLE_H = 60; // pasillo de circulación entre filas
  const ZONE_GAP_X = 140;
  const ZONE_GAP_Y = 120;
  const ZONE_COLS = 2; // las 10 zonas se disponen en 2 columnas × 5 filas

  const zoneW = COLS * SPACE_W + (COLS - 1) * GAP_X;
  const zoneH =
    (SPACES_PER_ZONE / COLS) * SPACE_H + (SPACES_PER_ZONE / COLS - 1) * AISLE_H;

  const spaces = zones.flatMap((zone, zoneIndex) => {
    const originX = (zoneIndex % ZONE_COLS) * (zoneW + ZONE_GAP_X);
    const originY = Math.floor(zoneIndex / ZONE_COLS) * (zoneH + ZONE_GAP_Y);

    return Array.from({ length: SPACES_PER_ZONE }, (_, i) => {
      const number = i + 1;
      const col = i % COLS;
      const row = Math.floor(i / COLS);

      // Los 3 primeros de cada zona son accesibles (más cerca del acceso) y
      // los 5 últimos, de motocicleta
      const isAccessible = number <= 3;
      const isMotorcycle = number > SPACES_PER_ZONE - 5;

      const type = isAccessible
        ? SpaceType.ACCESSIBLE
        : isMotorcycle
          ? SpaceType.MOTORCYCLE
          : zone.type;

      return {
        zoneId: zoneIds.get(zone.code)!,
        code: `${zone.code}-${String(number).padStart(3, '0')}`,
        number,
        type,
        isAccessible,
        isCovered: zone.isCovered,
        priority: isAccessible ? 1 : zone.priority,
        positionX: originX + col * (SPACE_W + GAP_X),
        positionY: originY + row * (SPACE_H + AISLE_H),
        width: isMotorcycle ? SPACE_W / 2 : SPACE_W,
        height: SPACE_H,
        rotation: 0,
      };
    });
  });

  // createMany en una sola consulta: insertar ~1.000 filas de a una tarda
  // decenas de segundos. skipDuplicates hace el seed reejecutable.
  const { count } = await prisma.parkingSpace.createMany({
    data: spaces,
    skipDuplicates: true,
  });

  const totalSpaces = await prisma.parkingSpace.count();

  // El plano completo, para referencia del viewBox del mapa (Sprint 4)
  const planWidth = ZONE_COLS * zoneW + (ZONE_COLS - 1) * ZONE_GAP_X;
  const planHeight =
    Math.ceil(zones.length / ZONE_COLS) * zoneH +
    (Math.ceil(zones.length / ZONE_COLS) - 1) * ZONE_GAP_Y;

  await prisma.parkingLot.update({
    where: { id: lot.id },
    data: { totalSpaces },
  });

  console.log(`✅ ${count} puestos insertados (${totalSpaces} en total)`);
  console.log(`   Códigos: A-001 … J-100`);
  console.log(`   Plano: ${planWidth} × ${planHeight} unidades\n`);

  console.log('🎉 Seed completado correctamente!\n');
  console.log('─'.repeat(50));
  console.log('  Admin:    admin@ujap.edu.ve    / Admin1234!');
  console.log('  Usuarios: [nombre].[apellido]@ujap.edu.ve / User1234!');
  console.log('─'.repeat(50));
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
