# DOCUMENTO MAESTRO DE DESARROLLO
## Sistema de Gestión y Reserva de Estacionamientos — Universidad José Antonio Páez

**Código del proyecto:** UJAP-PARKING  
**Versión:** 1.0  
**Tipo de solución inicial:** Aplicación Web  
**Backend:** NestJS — Arquitectura Monolítica Modular  
**Frontend recomendado:** React.js / Next.js  
**Base de datos recomendada:** PostgreSQL  
**Evolución prevista:** Aplicación móvil reutilizando la misma API  
**Escala inicial estimada:** ~1.000 puestos de estacionamiento  

---

# 0. PROPÓSITO DEL DOCUMENTO

Este documento funciona como **fuente maestra de verdad del proyecto** y como guía de implementación para un agente de desarrollo como Claude.

Claude deberá utilizar este archivo para:

- comprender el alcance completo de la aplicación;
- desarrollar el sistema por sprints;
- mantener consistencia entre backend, frontend y base de datos;
- evitar implementar funcionalidades fuera de alcance;
- mantener una arquitectura preparada para crecimiento;
- documentar decisiones técnicas;
- generar migraciones, pruebas y documentación API;
- permitir que una futura aplicación móvil consuma exactamente el mismo backend.

La aplicación debe desarrollarse inicialmente como una **aplicación web responsive**.

---

# 1. VISIÓN DEL PRODUCTO

Desarrollar una plataforma de gestión de estacionamientos para la **Universidad José Antonio Páez**, capaz de administrar aproximadamente **1.000 puestos de estacionamiento**, permitiendo conocer en tiempo real cuáles puestos se encuentran:

- disponibles;
- ocupados;
- reservados;
- deshabilitados;
- temporalmente fuera de servicio.

El sistema tendrá inicialmente dos tipos principales de usuario:

1. **Usuario universitario**
   - Puede autenticarse.
   - Puede visualizar puestos disponibles.
   - Puede registrar en qué puesto se estacionó.
   - Puede liberar el puesto cuando se retire.
   - Puede consultar su estacionamiento actual.
   - Puede consultar su historial personal.

2. **Administrador**
   - Puede visualizar el estado global de todos los estacionamientos.
   - Puede administrar aproximadamente 1.000 puestos desde una representación visual.
   - Puede deshabilitar puestos temporalmente.
   - Puede reservar puestos previamente.
   - Puede reservar puestos para personas externas a la universidad.
   - Puede gestionar reservas especiales para eventos como graduaciones, reuniones institucionales, profesores invitados, autoridades, proveedores y visitantes.
   - Puede asignar los mejores puestos antes de la llegada de los visitantes.
   - Puede consultar ocupación, disponibilidad e historial.
   - Puede crear, editar y administrar zonas y puestos.

---

# 2. OBJETIVOS DEL SISTEMA

## 2.1 Objetivo general

Construir una aplicación web centralizada para controlar la ocupación, reserva, disponibilidad y administración de los estacionamientos de la Universidad José Antonio Páez.

## 2.2 Objetivos específicos

- Digitalizar el registro de ocupación de puestos.
- Evitar inconsistencias por doble ocupación.
- Permitir reservas anticipadas.
- Dar al administrador una visualización completa de los estacionamientos.
- Permitir bloquear puestos por mantenimiento, pintura o eventos.
- Mantener historial de uso.
- Preparar el backend para una futura aplicación móvil.
- Proporcionar una API REST documentada.
- Garantizar trazabilidad de operaciones administrativas.
- Facilitar la expansión a sensores, QR, cámaras o IoT en versiones futuras.

---

# 3. ALCANCE DE LA VERSIÓN 1

## Incluido

- Aplicación web responsive.
- Autenticación.
- Gestión de usuarios.
- Roles USER y ADMIN.
- Gestión de zonas de estacionamiento.
- Gestión de puestos.
- Visualización gráfica de puestos.
- Registro de ocupación.
- Liberación de puesto.
- Reserva administrativa.
- Reserva para visitantes.
- Bloqueo/deshabilitación temporal.
- Historial.
- Auditoría básica.
- Dashboard administrativo.
- API REST.
- Swagger/OpenAPI.
- PostgreSQL.
- Migraciones de base de datos.
- Pruebas unitarias.
- Pruebas de integración.
- Pruebas E2E de flujos principales.
- Docker para desarrollo.

## Fuera del alcance inicial

No implementar en la primera versión:

- pagos;
- cobro por tiempo;
- lectura automática de matrículas;
- sensores IoT;
- reconocimiento de placas;
- cámaras;
- barreras automáticas;
- mapas GPS;
- navegación vehicular;
- app móvil nativa;
- integración con sistemas académicos;
- integración con carnet universitario;
- notificaciones push móviles;
- reserva autónoma de puestos por parte del usuario regular.

Estas funcionalidades podrán considerarse en versiones posteriores.

---

# 4. PRINCIPIOS DE ARQUITECTURA

La aplicación debe desarrollarse inicialmente como un **monolito modular en NestJS**.

No utilizar microservicios en la primera versión.

## 4.1 Razones

- dominio todavía manejable;
- aproximadamente 1.000 puestos;
- menor complejidad operativa;
- despliegue más sencillo;
- debugging centralizado;
- desarrollo académico más rápido;
- menor costo de infraestructura;
- posibilidad de extraer módulos posteriormente si la aplicación crece.

## 4.2 Regla principal

Aunque sea un monolito, el sistema debe estar dividido por **módulos funcionales independientes**.

Ejemplo:

```text
src/
├── app.module.ts
├── common/
├── config/
├── database/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── parking-lots/
│   ├── parking-zones/
│   ├── parking-spaces/
│   ├── parking-sessions/
│   ├── reservations/
│   ├── visitors/
│   ├── maintenance/
│   ├── dashboard/
│   ├── audit/
│   └── health/
└── main.ts
```

---

# 5. STACK TECNOLÓGICO RECOMENDADO

## Backend

- Node.js
- NestJS
- TypeScript
- PostgreSQL
- Prisma ORM o TypeORM

### Recomendación

Utilizar **Prisma** por:

- tipado fuerte;
- facilidad de migraciones;
- excelente experiencia con TypeScript;
- consultas claras;
- facilidad de mantenimiento.

## Frontend

Opción recomendada:

- React.js
- Next.js
- TypeScript
- Tailwind CSS
- TanStack Query
- React Hook Form
- Zod

## Autenticación

- JWT Access Token
- Refresh Token
- bcrypt o Argon2 para contraseñas

## Documentación

- Swagger / OpenAPI

## DevOps

- Docker
- Docker Compose
- Git
- GitHub o GitLab

## Pruebas

- Jest
- Supertest
- Playwright para E2E web

---

# 6. ARQUITECTURA GENERAL

```text
┌───────────────────────────────┐
│        CLIENTE WEB            │
│ React / Next.js               │
└───────────────┬───────────────┘
                │ HTTPS / REST
                ▼
┌───────────────────────────────┐
│        NESTJS MONOLITH        │
│                               │
│ Auth                          │
│ Users                         │
│ Parking Lots                  │
│ Zones                         │
│ Spaces                        │
│ Sessions                      │
│ Reservations                  │
│ Visitors                      │
│ Maintenance                   │
│ Dashboard                     │
│ Audit                         │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│          PostgreSQL           │
└───────────────────────────────┘
```

La futura aplicación móvil consumirá la misma API:

```text
Web ───────┐
           │
           ▼
       NestJS API
           ▲
           │
Mobile ────┘
```

---

# 7. ROLES DEL SISTEMA

## 7.1 USER

Representa estudiantes, profesores, empleados u otros miembros autorizados de la universidad.

Permisos:

- iniciar sesión;
- ver estacionamientos;
- consultar disponibilidad;
- ver mapa de puestos;
- seleccionar un puesto disponible;
- declarar “Me estacioné aquí”;
- liberar el puesto;
- consultar estacionamiento activo;
- consultar historial personal.

No puede:

- reservar puestos para terceros;
- bloquear puestos;
- modificar puestos;
- administrar usuarios;
- modificar zonas;
- cambiar estados administrativos.

## 7.2 ADMIN

Permisos:

- todos los permisos USER;
- visualizar toda la ocupación;
- crear estacionamientos;
- crear zonas;
- crear puestos;
- editar puestos;
- activar/desactivar puestos;
- crear reservas;
- crear visitantes;
- reservar puestos para visitantes;
- bloquear puestos por mantenimiento;
- desbloquear puestos;
- cancelar reservas;
- consultar historial completo;
- consultar dashboard;
- consultar logs de auditoría.

---

# 8. ENTIDADES PRINCIPALES

## 8.1 User

Campos recomendados:

```text
id
firstName
lastName
email
passwordHash
role
universityId
documentId
phone
status
createdAt
updatedAt
lastLoginAt
```

Role:

```text
USER
ADMIN
```

Status:

```text
ACTIVE
INACTIVE
SUSPENDED
```

---

## 8.2 ParkingLot

Representa un estacionamiento físico.

Ejemplos:

- Estacionamiento Principal
- Estacionamiento Profesores
- Estacionamiento Administrativo
- Estacionamiento Eventos

Campos:

```text
id
name
code
description
location
totalSpaces
isActive
createdAt
updatedAt
```

---

## 8.3 ParkingZone

Permite dividir grandes estacionamientos.

Ejemplos:

```text
Zona A
Zona B
Zona C
Zona Profesores
Zona Visitantes
Zona VIP
```

Campos:

```text
id
parkingLotId
name
code
description
floor
sortOrder
isActive
createdAt
updatedAt
```

---

## 8.4 ParkingSpace

Representa un puesto individual.

Ejemplo:

```text
A-001
A-002
A-003
...
B-001
```

Campos:

```text
id
zoneId
code
number
type
status
isAccessible
isCovered
priority
positionX
positionY
width
height
rotation
metadata
createdAt
updatedAt
```

### Tipos

```text
STANDARD
VISITOR
PROFESSOR
STAFF
ACCESSIBLE
VIP
MOTORCYCLE
OTHER
```

### Estados

```text
AVAILABLE
OCCUPIED
RESERVED
DISABLED
MAINTENANCE
```

---

# 9. MODELO DE ESTADOS DE UN PUESTO

```text
AVAILABLE
   │
   ├──── Usuario estaciona ────► OCCUPIED
   │
   ├──── Admin reserva ─────────► RESERVED
   │
   ├──── Admin deshabilita ─────► DISABLED
   │
   └──── Mantenimiento ─────────► MAINTENANCE

OCCUPIED
   │
   └──── Usuario libera ────────► AVAILABLE

RESERVED
   │
   ├──── visitante ocupa ───────► OCCUPIED
   ├──── reserva finaliza ──────► AVAILABLE
   └──── admin cancela ─────────► AVAILABLE

DISABLED
   │
   └──── admin habilita ────────► AVAILABLE

MAINTENANCE
   │
   └──── mantenimiento finaliza ► AVAILABLE
```

---

# 10. ParkingSession

Representa una ocupación real.

Campos:

```text
id
userId
parkingSpaceId
reservationId nullable
checkInAt
checkOutAt nullable
status
source
notes
createdAt
updatedAt
```

Status:

```text
ACTIVE
COMPLETED
CANCELLED
```

Source:

```text
WEB
MOBILE
ADMIN
```

---

# 11. Reservation

Representa una reserva anticipada.

Campos:

```text
id
parkingSpaceId
createdByAdminId
visitorId nullable
userId nullable
title
description
reservationType
startAt
endAt
status
priority
vehiclePlate
vehicleDescription
notes
createdAt
updatedAt
```

ReservationType:

```text
VISITOR
EVENT
PROFESSOR
AUTHORITY
STAFF
EXTERNAL
OTHER
```

Status:

```text
PENDING
CONFIRMED
ACTIVE
COMPLETED
CANCELLED
NO_SHOW
```

---

# 12. Visitor

Campos:

```text
id
firstName
lastName
documentId
email
phone
organization
vehiclePlate
vehicleBrand
vehicleModel
vehicleColor
notes
createdAt
updatedAt
```

---

# 13. MaintenanceBlock

Representa bloqueos temporales.

Campos:

```text
id
parkingSpaceId
createdById
reason
description
startAt
endAt
status
createdAt
updatedAt
```

Reason:

```text
PAINTING
MAINTENANCE
CONSTRUCTION
SECURITY
EVENT
OTHER
```

Status:

```text
SCHEDULED
ACTIVE
COMPLETED
CANCELLED
```

---

# 14. AuditLog

Toda acción administrativa crítica debe generar auditoría.

Campos:

```text
id
userId
action
entityType
entityId
oldValue
newValue
ipAddress
userAgent
createdAt
```

Ejemplos de acciones:

```text
SPACE_DISABLED
SPACE_ENABLED
SPACE_RESERVED
RESERVATION_CANCELLED
USER_CREATED
USER_UPDATED
ZONE_CREATED
MAINTENANCE_CREATED
```

---

# 15. REGLAS DE NEGOCIO

## RN-001

Un puesto no puede tener más de una ocupación activa simultánea.

## RN-002

Un usuario no puede tener más de una sesión activa de estacionamiento.

## RN-003

Un puesto `DISABLED` no puede ser ocupado.

## RN-004

Un puesto `MAINTENANCE` no puede ser ocupado.

## RN-005

Un puesto reservado no puede ser ocupado por otro usuario durante el período protegido de la reserva.

## RN-006

Una reserva no puede solaparse con otra reserva del mismo puesto.

## RN-007

El administrador puede cancelar una reserva futura.

## RN-008

Una reserva vencida debe poder pasar automáticamente a `COMPLETED` o `NO_SHOW`.

## RN-009

Un bloqueo por mantenimiento debe tener fecha de inicio y fin.

## RN-010

Si el bloqueo empieza inmediatamente, el puesto cambia a `MAINTENANCE`.

## RN-011

Los cambios administrativos deben quedar registrados.

## RN-012

El código de un puesto debe ser único.

## RN-013

El sistema debe validar concurrencia para evitar que dos usuarios ocupen el mismo puesto al mismo tiempo.

## RN-014

La ocupación debe confirmarse mediante una transacción de base de datos.

## RN-015

Al liberar el puesto, el estado debe regresar a `AVAILABLE`, excepto si existe una reserva o mantenimiento inmediatamente posterior.

---

# 16. RESERVAS ESPECIALES

El sistema debe soportar reservas anticipadas para eventos institucionales.

Ejemplo:

```text
Evento: Acto de graduación
Fecha: 25/11/2026
Horario: 08:00 – 14:00
Invitado: Profesor Juan Pérez
Puesto: VIP-003
Vehículo: Toyota Corolla
Placa: ABC123
```

El administrador debe poder:

- seleccionar la fecha;
- seleccionar horario;
- seleccionar visitante;
- seleccionar uno de los mejores puestos;
- registrar placa;
- añadir observaciones;
- confirmar reserva.

---

# 17. PRIORIZACIÓN DE PUESTOS

Cada puesto podrá incluir un campo:

```text
priority
```

Ejemplo:

```text
1 = máxima prioridad
2 = alta
3 = normal
4 = baja
```

Esto permite filtrar rápidamente:

- mejores puestos;
- puestos VIP;
- puestos cercanos;
- puestos para autoridades;
- puestos para profesores invitados.

---

# 18. VISUALIZACIÓN GRÁFICA

Uno de los componentes más importantes del sistema es el **mapa visual del estacionamiento**.

Cada puesto deberá renderizarse como un componente visual.

Ejemplo:

```text
┌──────┐
│ A001 │
└──────┘
```

Colores conceptuales:

```text
Verde      AVAILABLE
Rojo       OCCUPIED
Azul       RESERVED
Gris       DISABLED
Amarillo   MAINTENANCE
```

La información nunca debe depender únicamente del color.

También debe mostrarse:

- código;
- estado;
- icono;
- tooltip;
- accesibilidad.

---

# 19. COORDENADAS DEL MAPA

Para poder representar aproximadamente 1.000 puestos, cada `ParkingSpace` debe almacenar:

```text
positionX
positionY
width
height
rotation
```

Esto permitirá dibujar el estacionamiento dinámicamente.

El administrador podrá inicialmente cargar estas coordenadas desde base de datos o archivos seed.

En una versión posterior podrá existir un editor gráfico.

---

# 20. INTERFAZ DEL USUARIO

## Pantalla 01 — Login

Campos:

- correo;
- contraseña;
- iniciar sesión.

---

## Pantalla 02 — Inicio usuario

Mostrar:

- saludo;
- estacionamiento actual;
- disponibilidad total;
- zonas disponibles;
- botón “Buscar puesto”.

---

## Pantalla 03 — Mapa de estacionamiento

Mostrar:

- zonas;
- puestos;
- filtros;
- leyenda de estados.

Filtros:

- disponibles;
- cubiertos;
- accesibles;
- visitantes;
- profesores;
- VIP.

---

## Pantalla 04 — Registrar estacionamiento

Al seleccionar puesto:

```text
Puesto A-123
Estado: Disponible
Zona: A
```

Botón:

```text
ME ESTACIONÉ AQUÍ
```

Solicitar confirmación.

---

## Pantalla 05 — Mi estacionamiento

Mostrar:

```text
Puesto
Zona
Hora de entrada
Tiempo estacionado
```

Botón:

```text
SALIR / LIBERAR PUESTO
```

---

## Pantalla 06 — Historial

Mostrar:

- fecha;
- puesto;
- entrada;
- salida;
- duración.

---

# 21. INTERFAZ DEL ADMINISTRADOR

## Pantalla A01 — Dashboard

Indicadores:

```text
Puestos totales
Disponibles
Ocupados
Reservados
Deshabilitados
Mantenimiento
% ocupación
```

---

## Pantalla A02 — Mapa general

Visualización de todos los puestos.

Filtros:

- estacionamiento;
- zona;
- estado;
- tipo;
- prioridad.

---

## Pantalla A03 — Detalle de puesto

Mostrar:

```text
Código
Zona
Tipo
Estado
Reserva
Usuario actual
Hora de ocupación
```

Acciones:

```text
Reservar
Deshabilitar
Mantenimiento
Editar
Liberar administrativamente
```

---

## Pantalla A04 — Reservas

Mostrar calendario/listado.

Funciones:

- crear;
- editar;
- cancelar;
- buscar;
- filtrar.

---

## Pantalla A05 — Visitantes

Funciones:

- crear visitante;
- editar;
- consultar historial;
- registrar vehículo.

---

## Pantalla A06 — Mantenimiento

Funciones:

- bloquear puesto;
- programar bloqueo;
- indicar motivo;
- establecer fechas;
- reactivar.

---

## Pantalla A07 — Usuarios

Funciones:

- listar;
- crear;
- editar;
- activar/desactivar;
- cambiar rol.

---

## Pantalla A08 — Auditoría

Mostrar:

- administrador;
- acción;
- fecha;
- entidad;
- detalles.

---

# 22. DASHBOARD

KPIs recomendados:

```text
totalSpaces
availableSpaces
occupiedSpaces
reservedSpaces
disabledSpaces
maintenanceSpaces
occupancyRate
availableRate
reservationsToday
activeSessions
```

Gráficos posteriores:

- ocupación por hora;
- ocupación por zona;
- ocupación diaria;
- puestos más utilizados.

---

# 23. API REST

Prefijo:

```text
/api/v1
```

---

## Auth

```text
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /auth/me
```

---

## Users

```text
GET    /users
POST   /users
GET    /users/:id
PATCH  /users/:id
DELETE /users/:id
```

---

## Parking Lots

```text
GET    /parking-lots
POST   /parking-lots
GET    /parking-lots/:id
PATCH  /parking-lots/:id
DELETE /parking-lots/:id
```

---

## Zones

```text
GET    /parking-zones
POST   /parking-zones
GET    /parking-zones/:id
PATCH  /parking-zones/:id
DELETE /parking-zones/:id
```

---

## Spaces

```text
GET    /parking-spaces
POST   /parking-spaces
GET    /parking-spaces/:id
PATCH  /parking-spaces/:id
DELETE /parking-spaces/:id

GET /parking-spaces/available
GET /parking-spaces/map
```

---

## Parking Sessions

```text
POST /parking-sessions/check-in
POST /parking-sessions/:id/check-out

GET /parking-sessions/me/active
GET /parking-sessions/me/history

GET /parking-sessions
```

---

## Reservations

```text
GET    /reservations
POST   /reservations
GET    /reservations/:id
PATCH  /reservations/:id
DELETE /reservations/:id

POST /reservations/:id/cancel
POST /reservations/:id/activate
POST /reservations/:id/complete
```

---

## Visitors

```text
GET    /visitors
POST   /visitors
GET    /visitors/:id
PATCH  /visitors/:id
DELETE /visitors/:id
```

---

## Maintenance

```text
GET    /maintenance-blocks
POST   /maintenance-blocks
GET    /maintenance-blocks/:id
PATCH  /maintenance-blocks/:id
POST   /maintenance-blocks/:id/cancel
POST   /maintenance-blocks/:id/complete
```

---

## Dashboard

```text
GET /dashboard/summary
GET /dashboard/occupancy
GET /dashboard/zones
```

---

## Audit

```text
GET /audit-logs
GET /audit-logs/:id
```

---

# 24. SEGURIDAD

Implementar:

- JWT;
- refresh tokens;
- hashing de contraseñas;
- Guards;
- RolesGuard;
- DTO Validation;
- class-validator o Zod;
- helmet;
- CORS configurable;
- rate limiting;
- sanitización;
- manejo global de excepciones;
- logging;
- variables de entorno.

Nunca:

- almacenar contraseñas sin hash;
- exponer hashes;
- confiar en role enviado por frontend;
- permitir operaciones ADMIN únicamente mediante UI;
- construir queries concatenando strings.

---

# 25. CONTROL DE CONCURRENCIA

Este punto es crítico.

Problema:

```text
Usuario A consulta A-001 → disponible
Usuario B consulta A-001 → disponible
Usuario A ocupa A-001
Usuario B intenta ocupar A-001
```

Solo uno debe ganar.

La operación `check-in` debe ejecutarse mediante:

- transacción;
- validación del estado;
- bloqueo o estrategia equivalente;
- actualización atómica.

Resultado esperado:

```text
A → 201 Created
B → 409 Conflict
```

---

# 26. ÍNDICES DE BASE DE DATOS

Crear índices al menos para:

```text
ParkingSpace.status
ParkingSpace.zoneId
ParkingSpace.code

ParkingSession.userId
ParkingSession.parkingSpaceId
ParkingSession.status

Reservation.parkingSpaceId
Reservation.startAt
Reservation.endAt
Reservation.status

MaintenanceBlock.parkingSpaceId
MaintenanceBlock.startAt
MaintenanceBlock.endAt
```

---

# 27. DATOS INICIALES / SEED

Claude debe crear un seed.

Ejemplo:

```text
1 administrador
20 usuarios
1 estacionamiento
10 zonas
100 puestos por zona
≈ 1.000 puestos
```

Códigos:

```text
A-001 ... A-100
B-001 ... B-100
...
J-001 ... J-100
```

El seed debe permitir pruebas realistas.

---

# 28. WEBSOCKETS — FASE POSTERIOR RECOMENDADA

La primera versión puede funcionar con REST + refetch.

Posteriormente implementar WebSockets para que el mapa cambie inmediatamente.

Eventos:

```text
parking.space.updated
parking.session.started
parking.session.completed
reservation.created
reservation.cancelled
maintenance.started
maintenance.completed
```

Esto será especialmente útil cuando existan cientos de usuarios simultáneos.

---

# 29. CACHE — OPCIONAL

No implementar Redis inicialmente salvo necesidad real.

Optimizar primero:

- consultas;
- índices;
- paginación;
- endpoints específicos de mapa.

---

# 30. PAGINACIÓN

Todos los listados administrativos deben permitir:

```text
page
limit
search
sort
filters
```

Respuesta estándar:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1000,
    "totalPages": 50
  }
}
```

---

# 31. MANEJO DE ERRORES

Formato recomendado:

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "code": "PARKING_SPACE_NOT_AVAILABLE",
  "message": "El puesto seleccionado ya no se encuentra disponible",
  "timestamp": "2026-08-17T12:00:00Z",
  "path": "/api/v1/parking-sessions/check-in"
}
```

---

# 32. LOGGING

Registrar:

- errores;
- login;
- operaciones administrativas;
- reservas;
- cambios de estado;
- mantenimiento.

No registrar:

- contraseñas;
- tokens;
- información sensible innecesaria.

---

# 33. CONFIGURACIÓN DE ENTORNOS

Archivos:

```text
.env.example
.env.development
.env.test
.env.production
```

Variables:

```text
NODE_ENV
PORT
DATABASE_URL
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
JWT_ACCESS_EXPIRES_IN
JWT_REFRESH_EXPIRES_IN
CORS_ORIGIN
```

---

# 34. DOCKER

Crear:

```text
Dockerfile
docker-compose.yml
```

Servicios iniciales:

```text
api
postgres
```

Opcional:

```text
pgadmin
```

---

# 35. TESTING

## Unitarios

Cubrir:

- servicios;
- reglas de negocio;
- validaciones.

## Integración

Cubrir:

- repositorios;
- base de datos;
- transacciones.

## E2E

Flujos obligatorios:

### E2E-001

Usuario inicia sesión.

### E2E-002

Usuario visualiza disponibilidad.

### E2E-003

Usuario registra puesto.

### E2E-004

Otro usuario intenta ocupar el mismo puesto y recibe error.

### E2E-005

Usuario libera puesto.

### E2E-006

Admin reserva puesto.

### E2E-007

Puesto reservado no puede ser tomado por usuario no autorizado.

### E2E-008

Admin bloquea puesto por mantenimiento.

### E2E-009

Puesto bloqueado no puede ser ocupado.

### E2E-010

Admin habilita nuevamente puesto.

---

# 36. DEFINICIÓN DE HECHO GLOBAL

Una funcionalidad solo se considera terminada cuando:

- código implementado;
- lint correcto;
- TypeScript sin errores;
- pruebas correspondientes aprobadas;
- DTOs validados;
- Swagger actualizado;
- manejo de errores implementado;
- permisos revisados;
- migraciones incluidas;
- documentación actualizada;
- sin credenciales hardcodeadas.

---

# 37. GIT

Ramas sugeridas:

```text
main
develop
feature/*
fix/*
```

Commits:

```text
feat(auth): implement JWT login
feat(spaces): add parking space module
fix(reservations): prevent overlapping reservations
test(sessions): add concurrent check-in test
docs(api): update swagger documentation
```

---

# 38. ESTRATEGIA DE SPRINTS

Duración recomendada:

```text
1 sprint = 1 semana
```

Se proponen **12 sprints principales**.

---

# SPRINT 0 — DEFINICIÓN Y PREPARACIÓN

## Objetivo

Preparar repositorios, arquitectura, herramientas y convenciones.

## Tareas

- Crear repositorio.
- Crear proyecto NestJS.
- Crear frontend.
- Configurar TypeScript.
- Configurar ESLint.
- Configurar Prettier.
- Configurar PostgreSQL.
- Configurar Prisma.
- Configurar Docker.
- Crear `.env.example`.
- Configurar Swagger.
- Crear estructura modular.
- Crear README.
- Definir convenciones.
- Configurar CI básica.

## Entregable

Sistema inicia correctamente y conecta con PostgreSQL.

## DoD

```text
docker compose up
```

debe iniciar proyecto y base de datos.

---

# SPRINT 1 — AUTENTICACIÓN Y USUARIOS

## Objetivo

Implementar identidad y permisos.

## Backend

- User model.
- Role enum.
- Auth module.
- Login.
- JWT.
- Refresh token.
- Guards.
- RolesGuard.
- `/auth/me`.
- CRUD básico users ADMIN.

## Frontend

- Login.
- Logout.
- sesión persistente.
- rutas protegidas.
- layouts USER y ADMIN.

## Tests

- login correcto;
- contraseña incorrecta;
- acceso sin token;
- acceso ADMIN;
- acceso USER.

---

# SPRINT 2 — ESTACIONAMIENTOS Y ZONAS

## Objetivo

Construir estructura física.

## Backend

Implementar:

```text
ParkingLot
ParkingZone
```

CRUD ADMIN.

## Frontend

Pantallas administrativas:

- estacionamientos;
- zonas.

## Seed

Crear:

```text
1 estacionamiento
10 zonas
```

---

# SPRINT 3 — PUESTOS

## Objetivo

Gestionar los aproximadamente 1.000 puestos.

## Backend

Implementar `ParkingSpace`.

Campos geométricos incluidos.

Endpoints:

- CRUD;
- filtros;
- disponibilidad;
- mapa.

## Frontend

- listado administrativo;
- filtros;
- búsqueda;
- detalle de puesto.

## Seed

Crear aproximadamente 1.000 puestos.

---

# SPRINT 4 — MAPA VISUAL

## Objetivo

Crear la interfaz principal del estacionamiento.

## Frontend

Crear componente:

```text
ParkingMap
ParkingZone
ParkingSpace
ParkingLegend
ParkingFilters
```

Debe soportar aproximadamente 1.000 elementos sin degradación significativa.

Considerar:

- SVG;
- canvas;
- HTML optimizado.

Recomendación inicial:

```text
SVG
```

por facilidad de interacción.

---

# SPRINT 5 — REGISTRO DE OCUPACIÓN

## Objetivo

Permitir que el usuario registre dónde estacionó.

## Backend

Implementar:

```text
ParkingSession
```

Endpoints:

```text
check-in
check-out
active session
history
```

## Reglas

- usuario solo una sesión activa;
- puesto solo una sesión activa;
- puesto debe estar disponible;
- check-in transaccional.

## Frontend

- seleccionar puesto;
- confirmar;
- mostrar estacionamiento activo;
- liberar.

---

# SPRINT 6 — CONCURRENCIA Y CONSISTENCIA

## Objetivo

Blindar el sistema contra doble ocupación.

Implementar pruebas concurrentes.

Casos:

```text
2 usuarios → mismo puesto
10 usuarios → mismo puesto
```

Solo uno puede crear sesión.

Agregar:

- transaction handling;
- conflict exceptions;
- rollback.

---

# SPRINT 7 — RESERVAS ADMINISTRATIVAS

## Objetivo

Permitir reservas anticipadas.

Implementar:

```text
Reservation
```

Funciones:

- crear;
- editar;
- cancelar;
- activar;
- completar;
- buscar conflictos.

Validar solapamientos.

---

# SPRINT 8 — VISITANTES Y EVENTOS

## Objetivo

Gestionar visitantes externos.

Implementar:

```text
Visitor
```

Crear flujo:

```text
Crear visitante
   ↓
Registrar vehículo
   ↓
Seleccionar fecha
   ↓
Seleccionar mejor puesto
   ↓
Crear reserva
```

Ejemplo de uso principal:

```text
Graduaciones
Profesores invitados
Autoridades
Proveedores
Personas externas
```

---

# SPRINT 9 — BLOQUEOS Y MANTENIMIENTO

## Objetivo

Permitir retirar temporalmente puestos.

Implementar:

```text
MaintenanceBlock
```

Casos:

- pintura;
- reparación;
- construcción;
- seguridad;
- evento.

El mapa debe reflejar inmediatamente el estado.

---

# SPRINT 10 — DASHBOARD Y AUDITORÍA

## Objetivo

Proporcionar control administrativo.

Implementar dashboard:

```text
Total
Disponibles
Ocupados
Reservados
Deshabilitados
Mantenimiento
Ocupación %
```

Implementar:

```text
AuditLog
```

Registrar operaciones críticas.

---

# SPRINT 11 — HARDENING Y QA

## Objetivo

Preparar MVP final.

Actividades:

- pruebas E2E;
- revisión permisos;
- seguridad;
- validaciones;
- performance;
- accesibilidad;
- responsive;
- logs;
- documentación;
- Swagger;
- limpieza de código;
- revisión de dependencias.

Prueba con:

```text
1000 puestos
100 usuarios simultáneos simulados
```

---

# SPRINT 12 — DESPLIEGUE MVP

## Objetivo

Publicar primera versión.

Actividades:

- preparar producción;
- variables de entorno;
- Docker producción;
- backups PostgreSQL;
- HTTPS;
- dominio;
- observabilidad;
- health check;
- documentación operativa.

---

# 39. BACKLOG POST-MVP

## Sprint 13 — WebSockets

Actualización en tiempo real.

## Sprint 14 — App móvil

Opciones:

```text
React Native
Expo
Flutter
```

Recomendación:

```text
React Native + Expo
```

si el frontend web utiliza React.

## Sprint 15 — QR

Cada puesto puede tener QR.

Flujo:

```text
Escanear QR
↓
Abrir app
↓
Validar puesto
↓
Registrar estacionamiento
```

## Sprint 16 — Notificaciones

- reserva próxima;
- reserva vencida;
- mantenimiento;
- eventos.

## Sprint 17 — Integraciones

Posibles:

- sistema de estudiantes;
- profesores;
- empleados;
- carnet universitario.

## Sprint 18 — IoT

Posibles sensores físicos para detectar ocupación.

---

# 40. CASOS DE USO

## CU-001 — Login

Actor: USER / ADMIN.

## CU-002 — Visualizar puestos

Actor: USER.

## CU-003 — Registrar estacionamiento

Actor: USER.

## CU-004 — Liberar puesto

Actor: USER.

## CU-005 — Consultar historial

Actor: USER.

## CU-006 — Visualizar mapa global

Actor: ADMIN.

## CU-007 — Reservar puesto

Actor: ADMIN.

## CU-008 — Crear visitante

Actor: ADMIN.

## CU-009 — Bloquear puesto

Actor: ADMIN.

## CU-010 — Habilitar puesto

Actor: ADMIN.

## CU-011 — Administrar zonas

Actor: ADMIN.

## CU-012 — Administrar usuarios

Actor: ADMIN.

## CU-013 — Consultar dashboard

Actor: ADMIN.

## CU-014 — Consultar auditoría

Actor: ADMIN.

---

# 41. HISTORIAS DE USUARIO

## US-001

Como usuario quiero iniciar sesión para acceder al sistema.

## US-002

Como usuario quiero ver los puestos disponibles para saber dónde estacionarme.

## US-003

Como usuario quiero seleccionar el puesto donde me estacioné para registrar su ocupación.

## US-004

Como usuario quiero liberar el puesto cuando salga.

## US-005

Como administrador quiero visualizar todos los puestos para conocer el estado del estacionamiento.

## US-006

Como administrador quiero reservar un puesto para un visitante antes de su llegada.

## US-007

Como administrador quiero priorizar los mejores puestos para profesores invitados o autoridades.

## US-008

Como administrador quiero deshabilitar un puesto por pintura o mantenimiento.

## US-009

Como administrador quiero consultar estadísticas de ocupación.

## US-010

Como administrador quiero saber quién realizó cambios críticos.

---

# 42. CRITERIOS DE ACEPTACIÓN CLAVE

## Registrar estacionamiento

Given:

```text
usuario autenticado
puesto AVAILABLE
usuario sin sesión activa
```

When:

```text
usuario confirma puesto
```

Then:

```text
se crea ParkingSession
puesto → OCCUPIED
usuario obtiene confirmación
```

---

## Puesto ocupado

Given:

```text
puesto OCCUPIED
```

When:

```text
otro usuario intenta ocuparlo
```

Then:

```text
HTTP 409
no se crea sesión
```

---

## Reserva administrativa

Given:

```text
puesto sin reservas solapadas
```

When:

```text
ADMIN crea reserva
```

Then:

```text
reserva CONFIRMED
```

---

## Mantenimiento

Given:

```text
puesto AVAILABLE
```

When:

```text
ADMIN crea bloqueo inmediato
```

Then:

```text
puesto → MAINTENANCE
```

---

# 43. DIAGRAMA ENTIDAD-RELACIÓN CONCEPTUAL

```text
User
 │
 ├──────── ParkingSession ─────── ParkingSpace
 │                                  │
 │                                  └── ParkingZone
 │                                        │
 │                                        └── ParkingLot
 │
 └──────── Reservation ─────────── ParkingSpace
             │
             └── Visitor

ParkingSpace
 │
 └──────── MaintenanceBlock

User
 │
 └──────── AuditLog
```

---

# 44. POLÍTICA DE RESERVAS

La reserva debe incluir:

- inicio;
- fin;
- responsable;
- motivo;
- puesto;
- visitante o usuario;
- placa opcional.

Debe evitarse:

```text
R1: 08:00–10:00
R2: 09:00–11:00
```

porque existe solapamiento.

Debe permitirse:

```text
R1: 08:00–10:00
R2: 10:00–12:00
```

si la política institucional permite reservas consecutivas.

---

# 45. JOBS PROGRAMADOS

Implementar Scheduler de NestJS en fase apropiada.

Jobs:

```text
activar reservas
finalizar reservas
activar mantenimiento
finalizar mantenimiento
detectar no-show
```

Frecuencia sugerida:

```text
cada minuto
```

o mediante estrategia basada en timestamps.

---

# 46. PERFORMANCE

Para ~1.000 puestos:

- endpoint de mapa debe devolver solamente datos necesarios;
- evitar relaciones innecesarias;
- utilizar índices;
- evitar N+1 queries;
- usar paginación en listados;
- medir tiempo de respuesta.

Objetivos orientativos:

```text
GET map < 500 ms
check-in < 500 ms
dashboard < 1 s
```

bajo carga normal.

---

# 47. ACCESSIBILITY

Implementar:

- navegación por teclado;
- ARIA labels;
- contraste;
- estados con iconos y texto;
- no depender exclusivamente del color.

---

# 48. RESPONSIVE

La aplicación web debe funcionar en:

```text
Desktop
Laptop
Tablet
Smartphone
```

Esto permitirá validar UX móvil antes de desarrollar aplicación nativa.

---

# 49. ESTRUCTURA SUGERIDA DEL BACKEND

```text
src/
├── common/
│   ├── decorators/
│   ├── guards/
│   ├── filters/
│   ├── interceptors/
│   ├── pipes/
│   ├── enums/
│   └── utils/
│
├── config/
│
├── database/
│   ├── prisma/
│   └── seeds/
│
├── modules/
│   ├── auth/
│   ├── users/
│   ├── parking-lots/
│   ├── parking-zones/
│   ├── parking-spaces/
│   ├── parking-sessions/
│   ├── reservations/
│   ├── visitors/
│   ├── maintenance/
│   ├── dashboard/
│   ├── audit/
│   └── health/
│
├── app.module.ts
└── main.ts
```

---

# 50. ESTRUCTURA DE CADA MÓDULO

Ejemplo:

```text
parking-spaces/
├── dto/
│   ├── create-parking-space.dto.ts
│   ├── update-parking-space.dto.ts
│   └── parking-space-query.dto.ts
├── entities/
├── parking-spaces.controller.ts
├── parking-spaces.service.ts
├── parking-spaces.repository.ts
├── parking-spaces.module.ts
└── parking-spaces.spec.ts
```

---

# 51. REGLAS PARA CLAUDE

Claude debe seguir estrictamente estas instrucciones durante el desarrollo.

## Regla 1

No cambiar arquitectura monolítica por microservicios sin autorización.

## Regla 2

No agregar dependencias sin explicar su propósito.

## Regla 3

Antes de desarrollar cada sprint:

1. leer este documento;
2. revisar sprint actual;
3. revisar entidades relacionadas;
4. revisar reglas de negocio;
5. revisar código existente.

## Regla 4

Al finalizar cada sprint entregar:

```text
1. resumen de cambios;
2. archivos creados;
3. archivos modificados;
4. migraciones;
5. endpoints;
6. pruebas;
7. instrucciones para ejecutar;
8. pendientes;
```

## Regla 5

No eliminar funcionalidades ya implementadas para resolver una nueva tarea.

## Regla 6

No duplicar lógica entre módulos.

## Regla 7

Mantener servicios enfocados.

## Regla 8

Toda operación crítica debe validar permisos.

## Regla 9

Toda modificación de esquema requiere migración.

## Regla 10

Toda nueva ruta debe documentarse en Swagger.

## Regla 11

Toda regla de negocio importante requiere pruebas.

## Regla 12

No asumir requisitos nuevos. Si existe ambigüedad menor, elegir la opción más conservadora y documentarla.

---

# 52. PROMPT MAESTRO PARA CLAUDE

Utilizar el siguiente texto al comenzar una sesión de desarrollo:

```text
Actúa como arquitecto de software y desarrollador senior especializado
en NestJS, PostgreSQL, Prisma, React y arquitectura modular.

Debes desarrollar el proyecto UJAP Parking utilizando como única fuente
de verdad el archivo DOCUMENTO_MAESTRO_UJAP_PARKING.md.

La aplicación es inicialmente una aplicación web para gestionar
aproximadamente 1.000 puestos de estacionamiento de la Universidad
José Antonio Páez.

La arquitectura backend debe ser un MONOLITO MODULAR desarrollado en
NestJS.

No debes convertir el sistema a microservicios.

Antes de modificar código:

1. Lee el Documento Maestro completo.
2. Identifica el sprint actual.
3. Identifica módulos involucrados.
4. Identifica reglas de negocio afectadas.
5. Revisa el código existente.
6. Propón brevemente los archivos a crear o modificar.

Implementa únicamente el alcance correspondiente al sprint solicitado.

Debes:

- escribir código TypeScript estricto;
- respetar arquitectura modular;
- utilizar DTOs;
- validar entradas;
- proteger endpoints por roles;
- crear migraciones;
- documentar API con Swagger;
- añadir pruebas;
- evitar duplicación;
- manejar correctamente errores;
- utilizar transacciones para operaciones concurrentes;
- mantener compatibilidad futura con app móvil.

Nunca debes:

- hardcodear secretos;
- eliminar lógica funcional existente;
- modificar el esquema sin migración;
- permitir doble ocupación de un puesto;
- permitir una segunda sesión activa por usuario;
- permitir reservas solapadas;
- confiar en permisos enviados por frontend.

Al finalizar cada tarea informa:

- qué implementaste;
- archivos creados;
- archivos modificados;
- migraciones;
- endpoints;
- pruebas;
- comandos necesarios;
- riesgos o pendientes.
```

---

# 53. PROMPT PARA EJECUTAR UN SPRINT

```text
Lee DOCUMENTO_MAESTRO_UJAP_PARKING.md.

Vamos a desarrollar el SPRINT [NÚMERO].

Antes de escribir código:

1. Resume el objetivo del sprint.
2. Lista historias de usuario relacionadas.
3. Lista reglas de negocio relacionadas.
4. Lista archivos que planeas crear.
5. Lista archivos que planeas modificar.
6. Indica migraciones necesarias.
7. Indica endpoints afectados.

Después implementa el sprint completo.

No implementes funcionalidades pertenecientes a sprints posteriores,
salvo componentes técnicos estrictamente necesarios.

Al finalizar ejecuta o indica:

npm run lint
npm run test
npm run test:e2e
npm run build

Entrega un resumen técnico final.
```

---

# 54. CHECKLIST DE REVISIÓN POR SPRINT

Antes de considerar un sprint terminado:

- [ ] Requisitos implementados.
- [ ] Sin errores TypeScript.
- [ ] Lint aprobado.
- [ ] Build aprobado.
- [ ] Tests unitarios aprobados.
- [ ] Tests integración aprobados.
- [ ] Tests E2E críticos aprobados.
- [ ] Swagger actualizado.
- [ ] Migraciones creadas.
- [ ] Seed actualizado si aplica.
- [ ] Roles validados.
- [ ] Errores manejados.
- [ ] README actualizado si aplica.
- [ ] Sin secretos.
- [ ] Sin código muerto.
- [ ] Sin TODO críticos.
- [ ] Sin duplicación evidente.

---

# 55. CHECKLIST PRE-PRODUCCIÓN

- [ ] HTTPS.
- [ ] JWT secrets seguros.
- [ ] Base de datos producción.
- [ ] Backups automáticos.
- [ ] Logs.
- [ ] Health endpoint.
- [ ] CORS limitado.
- [ ] Rate limiting.
- [ ] Usuarios admin seguros.
- [ ] Seed demo deshabilitado.
- [ ] Swagger protegido o deshabilitado si la política lo exige.
- [ ] Migraciones aplicadas.
- [ ] Pruebas E2E aprobadas.
- [ ] Monitoreo.
- [ ] Política de recuperación documentada.

---

# 56. MÉTRICAS DE ÉXITO DEL MVP

El MVP se considera funcional si:

1. puede manejar aproximadamente 1.000 puestos;
2. el usuario puede registrar y liberar puesto;
3. no se producen dobles ocupaciones;
4. el administrador ve todos los estados;
5. el administrador puede reservar;
6. el administrador puede bloquear puestos;
7. las reservas no se solapan;
8. existe historial;
9. existe auditoría administrativa;
10. la aplicación funciona correctamente desde navegador móvil.

---

# 57. EVOLUCIÓN A APP MÓVIL

El backend no debe depender del frontend web.

La API debe ser completamente reutilizable.

Futura arquitectura:

```text
                         ┌──────────────┐
                         │ React Web    │
                         └──────┬───────┘
                                │
                                │
┌──────────────┐                │
│ React Native │──────────────► API NestJS
└──────────────┘                │
                                │
                         ┌──────▼───────┐
                         │ PostgreSQL   │
                         └──────────────┘
```

La autenticación, reservas, sesiones y lógica permanecerán en backend.

---

# 58. POSIBLES FUNCIONALIDADES FUTURAS

- QR por puesto.
- QR en carnet universitario.
- sensores de ocupación.
- cámaras.
- reconocimiento de matrícula.
- lector de carnet.
- reservación desde móvil.
- notificaciones push.
- mapa GPS.
- navegación hasta puesto.
- disponibilidad predictiva.
- analítica avanzada.
- integración con eventos universitarios.
- integración con calendario académico.
- registro automático de visitantes.
- autorización mediante correo.
- códigos QR temporales de visitante.

---

# 59. RIESGOS DEL PROYECTO

## Riesgo 1 — Doble ocupación

Mitigación:

- transacciones;
- pruebas concurrentes.

## Riesgo 2 — Mapa lento

Mitigación:

- endpoint optimizado;
- SVG;
- evitar componentes innecesarios;
- memoization.

## Riesgo 3 — Reservas inconsistentes

Mitigación:

- validación de solapamientos;
- restricciones;
- transacciones.

## Riesgo 4 — Usuario olvida liberar puesto

Futuras mitigaciones:

- recordatorios;
- expiración configurable;
- administrador puede liberar manualmente.

## Riesgo 5 — Datos físicos incorrectos

Mitigación:

- inventario inicial;
- códigos normalizados;
- importación/seed controlado.

---

# 60. DECISIONES ARQUITECTÓNICAS INICIALES

## ADR-001

**Decisión:** utilizar monolito modular.

## ADR-002

**Decisión:** utilizar PostgreSQL.

## ADR-003

**Decisión:** utilizar API REST.

## ADR-004

**Decisión:** diseñar API independiente del frontend.

## ADR-005

**Decisión:** manejar estados explícitos de puestos.

## ADR-006

**Decisión:** registrar ocupación mediante ParkingSession.

## ADR-007

**Decisión:** separar Reservation de ParkingSession.

## ADR-008

**Decisión:** guardar coordenadas visuales en ParkingSpace.

## ADR-009

**Decisión:** implementar auditoría de cambios administrativos.

---

# 61. ROADMAP RESUMIDO

```text
SPRINT 0
Preparación

SPRINT 1
Auth + Users

SPRINT 2
Parking Lots + Zones

SPRINT 3
Parking Spaces

SPRINT 4
Mapa Visual

SPRINT 5
Check-in / Check-out

SPRINT 6
Concurrencia

SPRINT 7
Reservas

SPRINT 8
Visitantes + Eventos

SPRINT 9
Mantenimiento

SPRINT 10
Dashboard + Auditoría

SPRINT 11
QA + Seguridad + Performance

SPRINT 12
Deploy MVP

POST-MVP
WebSockets
Mobile
QR
Notificaciones
Integraciones
IoT
```

---

# 62. RESULTADO ESPERADO DEL MVP

Al finalizar el Sprint 12 la universidad dispondrá de una aplicación web que permita:

### Usuario

```text
Login
↓
Visualizar estacionamiento
↓
Seleccionar puesto
↓
Registrar ocupación
↓
Consultar puesto activo
↓
Liberar puesto
```

### Administrador

```text
Login
↓
Dashboard
↓
Mapa de ~1000 puestos
↓
Consultar estado
↓
Reservar / Bloquear / Administrar
↓
Gestionar visitantes
↓
Consultar historial y auditoría
```

---

# 63. PRINCIPIO FINAL

El sistema debe priorizar:

```text
CONSISTENCIA
SEGURIDAD
TRAZABILIDAD
USABILIDAD
ESCALABILIDAD RAZONABLE
MANTENIBILIDAD
```

No se busca crear una arquitectura innecesariamente compleja.

El objetivo es construir primero un **monolito modular sólido, probado y bien organizado**, que permita validar la operación real del estacionamiento universitario y posteriormente evolucionar hacia una aplicación móvil y funciones avanzadas.

---

**FIN DEL DOCUMENTO MAESTRO — UJAP PARKING v1.0**
