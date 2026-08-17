import { PrismaClient, Role, UserStatus } from '@prisma/client';
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
