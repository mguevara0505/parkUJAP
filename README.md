# UJAP Parking 🚗

**Sistema de Gestión y Reserva de Estacionamientos**  
**Universidad José Antonio Páez**

---

## 📋 Descripción

Plataforma web para gestionar aproximadamente **1.000 puestos de estacionamiento** de la Universidad José Antonio Páez. Permite a usuarios registrar su ocupación y al administrador visualizar el estado global, reservar puestos y gestionar visitantes.

---

## 🧩 Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | NestJS 11 + TypeScript |
| ORM | Prisma 7 |
| Base de datos | PostgreSQL 16 |
| Frontend | Next.js 16 (App Router) + Tailwind CSS |
| Autenticación | JWT (Access + Refresh) |
| Documentación | Swagger/OpenAPI |
| Testing | Jest + Supertest + Playwright |
| DevOps | Docker + Docker Compose |

---

## 🚀 Inicio Rápido

### Requisitos

- Node.js >= 20
- Docker Desktop
- npm >= 10

### 1. Clonar y configurar entorno

```bash
# Copiar variables de entorno del backend
cp backend/.env.example backend/.env.development
```

### 2. Levantar con Docker Compose

```bash
docker compose up --build
```

Esto levanta automáticamente:
- **PostgreSQL** en `localhost:5432`
- **API NestJS** en `localhost:3001`
- **Frontend Next.js** en `localhost:3000`
- **pgAdmin** en `localhost:5050`

### 3. Sin Docker (desarrollo local)

```bash
# 1. Solo la base de datos en Docker
docker compose up -d postgres

# 2. Backend
cd backend
npm install
npx prisma migrate deploy   # aplica las migraciones existentes
npm run seed                # 1 admin, 20 usuarios, 1 estacionamiento, 10 zonas, 1.000 puestos
npm run start:dev

# 3. Frontend (otra terminal)
cd frontend
npm install
npm run dev
```

### Credenciales del seed

| Rol | Correo | Contraseña |
|-----|--------|-----------|
| ADMIN | `admin@ujap.edu.ve` | `Admin1234!` |
| USER | `carlos.rodriguez@ujap.edu.ve` | `User1234!` |

---

## 📚 URLs

| Servicio | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:3001/api/v1 |
| Swagger | http://localhost:3001/api/v1/docs |
| Health | http://localhost:3001/api/v1/health |
| pgAdmin | http://localhost:5050 |

---

## 👤 Roles

| Rol | Descripción |
|-----|-------------|
| `USER` | Estudiante/profesor/empleado — registra su estacionamiento |
| `ADMIN` | Administrador — gestiona puestos, reservas y visitantes |

---

## 📦 Estructura del Proyecto

```
ujap-parking/
├── backend/                    ← NestJS Monolito Modular
│   ├── src/
│   │   ├── common/             ← Guards, decorators, filters, interceptors
│   │   ├── config/             ← Configuración tipada
│   │   ├── database/           ← Prisma Service + Seeds
│   │   └── modules/            ← Módulos funcionales
│   │       ├── auth/
│   │       ├── users/
│   │       ├── parking-lots/
│   │       ├── parking-zones/
│   │       ├── parking-spaces/
│   │       ├── parking-sessions/
│   │       ├── reservations/
│   │       ├── visitors/
│   │       ├── maintenance/
│   │       ├── dashboard/
│   │       ├── audit/
│   │       └── health/
│   └── prisma/
│       └── schema.prisma       ← Todos los modelos
├── frontend/                   ← Next.js 16 (src/proxy.ts protege las rutas)
├── docker-compose.yml
└── README.md
```

---

## 🗓️ Sprints

| Sprint | Descripción | Estado |
|--------|-------------|--------|
| 0 | Preparación y estructura base | ✅ Completado |
| 1 | Autenticación + Usuarios | ✅ Completado |
| 2 | Estacionamientos + Zonas | ✅ Completado |
| 3 | Puestos (~1.000) | ✅ Completado |
| 4 | Mapa Visual (SVG) | ✅ Completado |
| 5 | Check-in / Check-out | ✅ Completado |
| 6 | Concurrencia | ✅ Completado |
| 7 | Reservas administrativas | ✅ Completado |
| 8 | Visitantes y eventos | ✅ Completado |
| 9 | Bloqueos y mantenimiento | ⏳ En curso |
| 10 | Dashboard + Auditoría | ⏳ Pendiente |
| 11 | QA + Seguridad + Performance | ⏳ Pendiente |
| 12 | Deploy MVP | ⏳ Pendiente |

---

## 🧪 Tests

```bash
cd backend

# Unitarios
npm run test

# Watch mode
npm run test:watch

# Cobertura
npm run test:cov

# E2E — requiere PostgreSQL corriendo (docker compose up -d postgres)
npm run test:e2e
```

Los tests E2E crean y borran sus propios usuarios `e2e-*`, así que no dependen del seed
ni lo modifican.

---

## 📄 Licencia

Proyecto académico — Universidad José Antonio Páez.
