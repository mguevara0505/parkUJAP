# UJAP Parking 🚗

**Sistema de Gestión y Reserva de Estacionamientos**
**Universidad José Antonio Páez**

Plataforma web para gestionar los **1.000 puestos** del campus. El estudiante
registra dónde dejó el carro; el administrador ve el estado global, reserva
puestos para eventos, gestiona visitantes y bloquea puestos por mantenimiento.

---

## 🧩 Stack

| Capa | Tecnología |
|------|-----------|
| Backend | NestJS 11 + TypeScript (monolito modular) |
| ORM | Prisma 7 (driver adapter `@prisma/adapter-pg`) |
| Base de datos | PostgreSQL 16 |
| Frontend | Next.js 16 (App Router) + Tailwind CSS |
| Autenticación | JWT (access + refresh) |
| Documentación | Swagger / OpenAPI |
| Pruebas | Jest + Supertest (142 e2e, 22 unitarias) |
| DevOps | Docker + Docker Compose + GitHub Actions |

---

## 📋 Requisitos

- **Node.js 24** (es la versión de las imágenes Docker y del CI)
- **Docker Desktop**
- **npm 11** (viene con Node 24)

> ⚠️ **Docker Desktop hay que abrirlo a mano y aceptar el aviso de
> administrador de Windows.** Su motor no arranca solo: si el servicio
> `com.docker.service` está detenido, ningún comando `docker` funciona y no
> habrá base de datos. Es el fallo más común al empezar.

---

## 🚀 Puesta en marcha

### Paso 1 — Clonar y configurar

```bash
git clone https://github.com/mguevara0505/parkUJAP.git
cd parkUJAP
```

```bash
cp backend/.env.example backend/.env.development
```

> Los archivos `.env` no se versionan (están en `.gitignore`). Sin este paso el
> backend usa valores por defecto que funcionan en local, pero conviene tener
> el archivo para poder cambiarlos.

### Paso 2 — Elegir cómo levantarlo

#### Opción A — Todo con Docker (lo más rápido)

```bash
docker compose up --build
```

Levanta PostgreSQL, la API, el frontend y pgAdmin.

#### Opción B — Solo la base en Docker (recomendado para desarrollar)

```bash
docker compose up -d postgres
```

```bash
cd backend && npm install && npx prisma migrate deploy && npm run start:dev
```

```bash
cd frontend && npm install && npm run dev
```

### Paso 3 — Sembrar los datos ⚠️ **obligatorio la primera vez**

**La base arranca vacía: sin este paso no hay usuarios y no se puede entrar.**

Si usó la **opción A** (todo en Docker):

```bash
docker compose exec api npm run seed
```

Si usó la **opción B** (backend local):

```bash
cd backend && npm run seed
```

Crea el administrador, 20 usuarios, 10 zonas y los 1.000 puestos. Se puede
volver a ejecutar cuantas veces haga falta: no duplica nada ni pisa las
contraseñas.

### Paso 4 — Entrar

Abrir **http://localhost:3000** — la aplicación arranca directamente en el
login. Las credenciales de prueba aparecen escritas en la propia pantalla.

---

## 👥 Usuarios de prueba

Todos los creados por el seed. **La contraseña es la misma para todos los
usuarios normales.**

### Administrador

| Correo | Contraseña |
|--------|-----------|
| `admin@ujap.edu.ve` | `Admin1234!` |

### Estudiantes — contraseña `User1234!`

Pueden estacionarse en las zonas **A, B, C, D** y ocupar **2 puestos a la vez**.

| Nombre | Correo | Cédula univ. |
|--------|--------|--------------|
| Carlos Rodríguez | `carlos.rodriguez@ujap.edu.ve` | 2023-001 |
| María González | `maria.gonzalez@ujap.edu.ve` | 2023-002 |
| Luis Martínez | `luis.martinez@ujap.edu.ve` | 2023-003 |
| Ana López | `ana.lopez@ujap.edu.ve` | 2023-004 |
| Pedro García | `pedro.garcia@ujap.edu.ve` | 2023-005 |
| Laura Hernández | `laura.hernandez@ujap.edu.ve` | 2023-006 |
| José Díaz | `jose.diaz@ujap.edu.ve` | 2023-007 |
| Sofía Fernández | `sofia.fernandez@ujap.edu.ve` | 2023-008 |
| Miguel Torres | `miguel.torres@ujap.edu.ve` | 2023-009 |
| Valentina Vargas | `valentina.vargas@ujap.edu.ve` | 2023-010 |
| Andrés Jiménez | `andres.jimenez@ujap.edu.ve` | 2024-001 |
| Isabella Morales | `isabella.morales@ujap.edu.ve` | 2024-002 |
| Diego Castillo | `diego.castillo@ujap.edu.ve` | 2024-003 |
| Camila Romero | `camila.romero@ujap.edu.ve` | 2024-004 |

### Profesores — contraseña `User1234!`

Zonas **E, F, G** · **1 puesto** a la vez.

| Nombre | Correo | Cédula univ. |
|--------|--------|--------------|
| Sebastián Flores | `sebastian.flores@ujap.edu.ve` | PROF-001 |
| Gabriela Reyes | `gabriela.reyes@ujap.edu.ve` | PROF-002 |
| Alejandro Cruz | `alejandro.cruz@ujap.edu.ve` | PROF-003 |
| Daniela Mora | `daniela.mora@ujap.edu.ve` | PROF-004 |

### Administrativos — contraseña `User1234!`

Zona **H** · **1 puesto** a la vez.

| Nombre | Correo | Cédula univ. |
|--------|--------|--------------|
| Ricardo Sánchez | `ricardo.sanchez@ujap.edu.ve` | ADM-001 |
| Mariana Gutiérrez | `mariana.gutierrez@ujap.edu.ve` | ADM-002 |

---

## 🅿️ Cómo se usa

### Si entra como estudiante, profesor o administrativo

**Registrar dónde se estacionó** — el camino corto:

1. En la pantalla de inicio, escribir el **código pintado en el piso**
   (`A-050`). Vale escribirlo como sea: `a50`, `A50`, `a-50` → todos
   encuentran **A-050**.
2. Pulsar **Buscar**. Aparece el puesto con su zona y su estado.
3. Pulsar **ME ESTACIONÉ AQUÍ**.

**Si no sabe dónde estacionarse:** entrar en **Mapa** y usar «Puestos libres
más cercanos a la entrada», o tocar cualquier puesto verde del plano. El mapa
se actualiza solo cada 30 segundos.

**Al irse:** el botón **SALIR / LIBERAR PUESTO** está en la pantalla de inicio,
debajo del código donde está estacionado.

**En el teléfono** hay una barra inferior con las cuatro pantallas: Inicio,
Mapa, Mi puesto e Historial.

### Si entra como administrador

| Pantalla | Para qué |
|----------|----------|
| **Dashboard** | Ocupación global, por zona y por hora |
| **Mapa de Puestos** | Los 1.000 puestos. Al tocar uno se ve **quién lo ocupa, desde cuándo** y su reserva, y se puede **liberar administrativamente**, reservar, editar o bloquear |
| **Estacionamientos / Zonas / Puestos** | Estructura del campus. En Zonas se decide qué categoría entra en cada una |
| **Reservas** | Reservas por evento, visitante o autoridad. Sugiere los mejores puestos libres |
| **Visitantes** | Registro de visitantes y sus vehículos |
| **Mantenimiento** | Bloquear puestos con motivo y fechas |
| **Usuarios** | Crear, editar, activar/desactivar y cambiar categoría o rol |
| **Auditoría** | Toda escritura queda registrada. Las contraseñas se guardan como `[oculto]` |

---

## 📚 URLs

| Servicio | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:3001/api/v1 |
| Swagger | http://localhost:3001/api/v1/docs |
| Health | http://localhost:3001/api/v1/health |
| pgAdmin *(solo opción A)* | http://localhost:5050 — `admin@ujap.edu.ve` / `admin123` |

> pgAdmin tarda cerca de un minuto en levantar. Si no responde al principio,
> no está roto: hay que darle tiempo.

---

## 👤 Roles y categorías

Son dos ejes independientes: el **rol** decide qué puede hacer en el sistema, la
**categoría** decide dónde puede estacionarse.

| Rol | Descripción |
|-----|-------------|
| `USER` | Registra su propio estacionamiento |
| `ADMIN` | Gestiona puestos, reservas, visitantes y usuarios |

| Categoría | Zonas | Puestos a la vez |
|-----------|-------|------------------|
| `STUDENT` | A, B, C, D | 2 |
| `PROFESSOR` | E, F, G | 1 |
| `STAFF` | H | 1 |

Las zonas **I y J** no admiten registro por iniciativa propia: se acceden solo
mediante una reserva administrativa (autoridades, proveedores, visitantes y
eventos). Quien tenga una reserva a su nombre sí puede ocupar ese puesto, sea
cual sea la zona.

Un estudiante puede necesitar dos puestos (carro y moto, o un vehículo
compartido); a profesores y administrativos les corresponde uno. El tope lo
impone un índice único de PostgreSQL, no un contador en código.

El reparto se cambia desde **Zonas**, con interruptores por categoría: dejarlas
todas apagadas convierte la zona en exclusiva de reserva. La regla la aplica el
backend, no solo la interfaz.

> Este reparto por categoría es una decisión posterior al Documento Maestro,
> que en su sección 7.1 trata a todos los usuarios por igual. Conviene
> reflejarlo allí.

---

## 🧪 Pruebas

```bash
cd backend
```

```bash
npm run test
```

```bash
npm run test:e2e
```

Los e2e necesitan PostgreSQL corriendo y el seed aplicado. Crean y borran sus
propios usuarios `e2e-*`, así que no dependen del resto de datos ni los
modifican.

### Prueba de carga

Comprueba los objetivos de rendimiento con los 100 usuarios simultáneos que
exige el Documento Maestro. Necesita la API ya levantada en otra terminal:

```bash
npm run test:load
```

Últimos resultados medidos (API en modo desarrollo, 1.000 puestos):

| Medida | Objetivo | p50 | p95 |
|--------|----------|-----|-----|
| `GET /parking-spaces/map` | < 500 ms | 186 ms | 323 ms |
| `GET /dashboard/summary` | < 1 s | 42 ms | 50 ms |
| `POST /parking-sessions/check-in` | < 500 ms | 381 ms | 393 ms |

Los tiempos son los del **último de 100 peticiones en cola**, no los de una
petición aislada. La prueba verifica además que 100 personas peleando por el
mismo puesto produzcan **exactamente una** ocupación.

---

## 📦 Estructura

```
parkUJAP/
├── backend/                    ← NestJS
│   ├── src/
│   │   ├── common/             ← Guards, filtros, interceptores
│   │   ├── database/           ← Prisma + seed
│   │   └── modules/            ← auth, users, parking-*, reservations,
│   │                             visitors, maintenance, dashboard, audit
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/         ← incluye SQL escrito a mano (ver abajo)
│   └── test/                   ← 11 suites e2e + prueba de carga
├── frontend/                   ← Next.js (src/proxy.ts protege las rutas)
├── scripts/                    ← backup.sh y restore.sh
├── .github/workflows/ci.yml
├── docker-compose.yml          ← desarrollo
├── docker-compose.prod.yml     ← producción
├── DESPLIEGUE.md               ← puesta en un servidor
└── README.md
```

> **Las migraciones llevan SQL escrito a mano** (índices únicos parciales y una
> restricción `EXCLUDE`) que Prisma no sabe expresar y que **son** las reglas de
> negocio: nadie puede ocupar dos veces el mismo puesto ni solapar reservas.
> Usar siempre `prisma migrate deploy`. Si `prisma migrate dev` propone
> eliminarlos, **no aceptar**.

---

## 🗓️ Sprints

| Sprint | Descripción | Estado |
|--------|-------------|--------|
| 0 | Preparación y estructura base | ✅ |
| 1 | Autenticación + Usuarios | ✅ |
| 2 | Estacionamientos + Zonas | ✅ |
| 3 | Puestos (1.000) | ✅ |
| 4 | Mapa visual (SVG) | ✅ |
| 5 | Check-in / Check-out | ✅ |
| 6 | Concurrencia | ✅ |
| 7 | Reservas administrativas | ✅ |
| 8 | Visitantes y eventos | ✅ |
| 9 | Bloqueos y mantenimiento | ✅ |
| 10 | Dashboard + Auditoría | ✅ |
| 11 | QA + Seguridad + Rendimiento | ✅ |
| 12 | Despliegue del MVP | ✅ |

Para poner el sistema en un servidor: **[DESPLIEGUE.md](DESPLIEGUE.md)**.

---

## 🔧 Problemas frecuentes

**`docker: cannot find the file specified` o los comandos `docker` se quedan
colgados.**
Docker Desktop no está corriendo o su motor no arrancó. Abrirlo a mano y
aceptar el aviso de administrador de Windows.

**No puedo entrar: «Credenciales incorrectas» con el usuario del seed.**
Falta sembrar la base (paso 3). Comprobar que hay usuarios:

```bash
docker compose exec postgres psql -U ujap_user -d ujap_parking_db -c "SELECT count(*) FROM users"
```

**«La base de datos no está disponible».**
PostgreSQL no terminó de arrancar o el contenedor está caído:

```bash
docker compose ps
```

**Demasiados intentos de inicio de sesión.**
El login admite 10 intentos cada 5 minutos **por correo** (no por IP, para no
castigar a todo el campus, que sale por un único NAT). Esperar cinco minutos o
entrar con otro usuario.

**El mapa no muestra puestos.**
Falta el seed, o hay filtros activos. En el panel de filtros, «Actualizar».

**Un puesto aparece ocupado y nadie lo usa.**
Desde **Mapa de Puestos**, tocarlo y usar «Liberar administrativamente» si
tiene sesión activa, o «Cambiar estado → Disponible» si no la tiene.

---

## 📄 Licencia

Proyecto académico — Universidad José Antonio Páez.
