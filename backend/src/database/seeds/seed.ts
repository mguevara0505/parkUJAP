import {
  PrismaClient,
  Role,
  SpaceType,
  UserCategory,
  UserStatus,
} from '@prisma/client';
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
      // Quien administra el sistema es, físicamente, personal administrativo
      category: UserCategory.STAFF,
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

  // Mezcla realista de categorías para poder probar el reparto de zonas
  const S = UserCategory.STUDENT;
  const P = UserCategory.PROFESSOR;
  const A = UserCategory.STAFF;

  const userNames = [
    {
      firstName: 'Carlos',
      lastName: 'Rodríguez',
      universityId: '2023-001',
      category: S,
    },
    {
      firstName: 'María',
      lastName: 'González',
      universityId: '2023-002',
      category: S,
    },
    {
      firstName: 'Luis',
      lastName: 'Martínez',
      universityId: '2023-003',
      category: S,
    },
    {
      firstName: 'Ana',
      lastName: 'López',
      universityId: '2023-004',
      category: S,
    },
    {
      firstName: 'Pedro',
      lastName: 'García',
      universityId: '2023-005',
      category: S,
    },
    {
      firstName: 'Laura',
      lastName: 'Hernández',
      universityId: '2023-006',
      category: S,
    },
    {
      firstName: 'José',
      lastName: 'Díaz',
      universityId: '2023-007',
      category: S,
    },
    {
      firstName: 'Sofía',
      lastName: 'Fernández',
      universityId: '2023-008',
      category: S,
    },
    {
      firstName: 'Miguel',
      lastName: 'Torres',
      universityId: '2023-009',
      category: S,
    },
    {
      firstName: 'Valentina',
      lastName: 'Vargas',
      universityId: '2023-010',
      category: S,
    },
    {
      firstName: 'Andrés',
      lastName: 'Jiménez',
      universityId: '2024-001',
      category: S,
    },
    {
      firstName: 'Isabella',
      lastName: 'Morales',
      universityId: '2024-002',
      category: S,
    },
    {
      firstName: 'Diego',
      lastName: 'Castillo',
      universityId: '2024-003',
      category: S,
    },
    {
      firstName: 'Camila',
      lastName: 'Romero',
      universityId: '2024-004',
      category: S,
    },
    {
      firstName: 'Sebastián',
      lastName: 'Flores',
      universityId: 'PROF-001',
      category: P,
    },
    {
      firstName: 'Gabriela',
      lastName: 'Reyes',
      universityId: 'PROF-002',
      category: P,
    },
    {
      firstName: 'Alejandro',
      lastName: 'Cruz',
      universityId: 'PROF-003',
      category: P,
    },
    {
      firstName: 'Daniela',
      lastName: 'Mora',
      universityId: 'PROF-004',
      category: P,
    },
    {
      firstName: 'Ricardo',
      lastName: 'Sánchez',
      universityId: 'ADM-001',
      category: A,
    },
    {
      firstName: 'Mariana',
      lastName: 'Gutiérrez',
      universityId: 'ADM-002',
      category: A,
    },
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
      // La categoría sí se reaplica: define en qué zonas puede estacionarse y
      // debe poder corregirse reejecutando el seed. La contraseña no se toca.
      update: { category: u.category, universityId: u.universityId },
      create: {
        firstName: u.firstName,
        lastName: u.lastName,
        email,
        passwordHash: userPasswordHash,
        role: Role.USER,
        category: u.category,
        status: UserStatus.ACTIVE,
        universityId: u.universityId,
      },
    });

    process.stdout.write(
      `  👤 ${u.firstName} ${u.lastName} [${u.category}] → ${email}\n`,
    );
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
  // Reparto del campus por categoría.
  //
  // El nombre NO incluye a quién pertenece la zona: eso lo dice
  // `allowedCategories`, y duplicarlo en el nombre haría que este mintiera en
  // cuanto un administrador cambiara el reparto. La interfaz compone la
  // etiqueta "Zona A · Estudiantes" a partir de una única fuente de verdad.
  //
  // `allowedCategories` vacío = solo por reserva (autoridades, proveedores,
  // eventos). Los visitantes externos no son usuarios del sistema: acceden
  // siempre mediante una reserva administrativa.
  const zones = [
    {
      code: 'A',
      name: 'Zona A',
      description: 'Cercana al edificio principal',
      type: SpaceType.STANDARD,
      priority: 2,
      isCovered: false,
      allowedCategories: [S],
    },
    {
      code: 'B',
      name: 'Zona B',
      description: 'Frente a la biblioteca',
      type: SpaceType.STANDARD,
      priority: 3,
      isCovered: false,
      allowedCategories: [S],
    },
    {
      code: 'C',
      name: 'Zona C',
      description: 'Lateral este',
      type: SpaceType.STANDARD,
      priority: 3,
      isCovered: false,
      allowedCategories: [S],
    },
    {
      code: 'D',
      name: 'Zona D',
      description: 'Área deportiva',
      type: SpaceType.STANDARD,
      priority: 4,
      isCovered: false,
      allowedCategories: [S],
    },
    {
      code: 'E',
      name: 'Zona E',
      description: 'Lateral oeste',
      type: SpaceType.PROFESSOR,
      priority: 3,
      isCovered: false,
      allowedCategories: [P],
    },
    {
      code: 'F',
      name: 'Zona F',
      description: 'Zona techada',
      type: SpaceType.PROFESSOR,
      priority: 2,
      isCovered: true,
      allowedCategories: [P],
    },
    {
      code: 'G',
      name: 'Zona G',
      description: 'Frente a las facultades',
      type: SpaceType.PROFESSOR,
      priority: 2,
      isCovered: false,
      allowedCategories: [P],
    },
    {
      code: 'H',
      name: 'Zona H',
      description: 'Junto al edificio administrativo',
      type: SpaceType.STAFF,
      priority: 3,
      isCovered: false,
      allowedCategories: [A],
    },
    {
      code: 'I',
      name: 'Zona I',
      description: 'Solo por reserva: visitantes y proveedores',
      type: SpaceType.VISITOR,
      priority: 2,
      isCovered: false,
      allowedCategories: [],
    },
    {
      code: 'J',
      name: 'Zona J',
      description: 'Solo por reserva: autoridades y eventos',
      type: SpaceType.VIP,
      priority: 1,
      isCovered: true,
      allowedCategories: [],
    },
  ];

  const zoneIds = new Map<string, string>();

  for (const [index, zone] of zones.entries()) {
    const created = await prisma.parkingZone.upsert({
      where: { code: zone.code },
      // El reparto por categoría sí se reaplica: es la regla vigente del
      // campus y debe poder corregirse reejecutando el seed
      update: {
        name: zone.name,
        description: zone.description,
        allowedCategories: zone.allowedCategories,
      },
      create: {
        code: zone.code,
        name: zone.name,
        description: zone.description,
        allowedCategories: zone.allowedCategories,
        parkingLotId: lot.id,
        floor: 1,
        sortOrder: index + 1,
      },
    });

    zoneIds.set(zone.code, created.id);
    const quien =
      zone.allowedCategories.length === 0
        ? 'solo por reserva'
        : zone.allowedCategories.join(', ');
    process.stdout.write(`  🅿️  ${zone.code} → ${zone.name} (${quien})\n`);
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
