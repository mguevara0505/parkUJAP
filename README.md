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
npm run seed                # admin, 20 usuarios por categoría, 10 zonas y 1.000 puestos
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

## 👤 Roles y categorías

Son dos ejes independientes: el **rol** decide qué puede hacer en el sistema, la
**categoría** decide dónde puede estacionarse.

| Rol | Descripción |
|-----|-------------|
| `USER` | Estudiante/profesor/empleado — registra su estacionamiento |
| `ADMIN` | Administrador — gestiona puestos, reservas y visitantes |

| Categoría | Zonas propias | Puestos a la vez |
|-----------|---------------|------------------|
| `STUDENT` | A, B, C, D | 2 |
| `PROFESSOR` | E, F, G | 1 |
| `STAFF` | H | 1 |

Las zonas **I y J** no admiten registro por iniciativa propia: se acceden solo
mediante una reserva administrativa (autoridades, proveedores, visitantes y
eventos). Un usuario con una reserva a su nombre sí puede ocupar el puesto
reservado, sea cual sea la zona.

Un estudiante puede necesitar dos puestos (coche y moto, o un vehículo
compartido); a profesores y administrativos les corresponde uno. El tope lo
impone un índice único de PostgreSQL sobre el cupo, no un contador en código.

Las categorías se asignan desde **Usuarios** y el reparto de zonas desde **Zonas**: cada zona
tiene interruptores por categoría, y dejarlas todas apagadas la convierte en
zona de reserva exclusiva. La regla la aplica el backend, no solo la interfaz.

> Este reparto por categoría es una decisión posterior al Documento Maestro,
> que en su sección 7.1 trata a todos los usuarios por igual. Conviene
> reflejarlo allí.

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
| 9 | Bloqueos y mantenimiento | ✅ Completado |
| 10 | Dashboard + Auditoría | ✅ Completado |
| 11 | QA + Seguridad + Performance | ✅ Completado |
| 12 | Deploy MVP | ✅ Completado |

Para poner el sistema en un servidor: **[DESPLIEGUE.md](DESPLIEGUE.md)**.

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

### Prueba de carga

Comprueba los objetivos de rendimiento de la sección 46 con los 100 usuarios
simultáneos que exige la sección 11, contra una API ya levantada:

```bash
npm run test:load
```

Mide el mapa, el dashboard y el check-in, y verifica que 100 personas peleando
por el mismo puesto produzcan **exactamente una** ocupación.

Últimos resultados medidos (API en modo desarrollo, 1.000 puestos):

| Medida | Objetivo | p50 | p95 |
|--------|----------|-----|-----|
| `GET /parking-spaces/map` | < 500 ms | 258 ms | 411 ms |
| `GET /dashboard/summary` | < 1 s | 52 ms | 61 ms |
| `POST /parking-sessions/check-in` | < 500 ms | 471 ms | 483 ms |

Los tiempos son los del **último de 100 peticiones en cola**, no los de una
petición aislada.

---

## 📄 Licencia

Proyecto académico — Universidad José Antonio Páez.
