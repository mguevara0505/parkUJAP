-- ═════════════════════════════════════════════════════════════════════════
-- UJAP Parking — Script SQL (PostgreSQL 16)
-- ═════════════════════════════════════════════════════════════════════════
--
-- CREATE TABLE de las 10 entidades del proyecto, con su PRIMARY KEY y sus
-- FOREIGN KEY. Reproduce la base de datos que generan las migraciones de
-- Prisma (backend/prisma/migrations), escrito a mano y ordenado para leerlo:
-- cada tabla se crea después de las tablas a las que apunta.
--
-- Los identificadores van entre comillas porque Prisma usa camelCase
-- ("parkingSpaceId") y PostgreSQL pasaría a minúsculas los nombres sin comillas.
--
-- Los "id" son TEXT con un UUID que genera la aplicación (Prisma, @default(uuid())).
--
-- Para probarlo en una base vacía:
--   psql -U postgres -d ujap_parking_demo -f docs/modelo-de-datos/schema.sql
-- ═════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────
-- 1. TIPOS ENUMERADOS
-- ─────────────────────────────────────────────

CREATE TYPE "Role"              AS ENUM ('USER', 'ADMIN');
CREATE TYPE "UserStatus"        AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
CREATE TYPE "UserCategory"      AS ENUM ('STUDENT', 'PROFESSOR', 'STAFF');
CREATE TYPE "SpaceType"         AS ENUM ('STANDARD', 'VISITOR', 'PROFESSOR', 'STAFF', 'ACCESSIBLE', 'VIP', 'MOTORCYCLE', 'OTHER');
CREATE TYPE "SpaceStatus"       AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'DISABLED', 'MAINTENANCE');
CREATE TYPE "SessionStatus"     AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "SessionSource"     AS ENUM ('WEB', 'MOBILE', 'ADMIN');
CREATE TYPE "ReservationType"   AS ENUM ('VISITOR', 'EVENT', 'PROFESSOR', 'AUTHORITY', 'STAFF', 'EXTERNAL', 'OTHER');
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
CREATE TYPE "MaintenanceReason" AS ENUM ('PAINTING', 'MAINTENANCE', 'CONSTRUCTION', 'SECURITY', 'EVENT', 'OTHER');
CREATE TYPE "MaintenanceStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED');


-- ─────────────────────────────────────────────
-- 2. USUARIOS Y AUTENTICACIÓN
-- ─────────────────────────────────────────────

-- Miembros de la universidad (estudiantes, profesores, personal) y administradores.
-- "role" decide QUÉ puede hacer; "category" decide DÓNDE puede estacionarse.
CREATE TABLE "users" (
    "id"           TEXT           NOT NULL,
    "firstName"    TEXT           NOT NULL,
    "lastName"     TEXT           NOT NULL,
    "email"        TEXT           NOT NULL,
    "passwordHash" TEXT           NOT NULL,
    "role"         "Role"         NOT NULL DEFAULT 'USER',
    "category"     "UserCategory" NOT NULL DEFAULT 'STUDENT',
    "universityId" TEXT,
    "documentId"   TEXT,
    "phone"        TEXT,
    "status"       "UserStatus"   NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt"  TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3)   NOT NULL,

    CONSTRAINT "users_pkey"      PRIMARY KEY ("id"),
    CONSTRAINT "users_email_key" UNIQUE ("email")
);

-- Tokens de refresco del JWT. Si se borra el usuario, se borran sus tokens.
CREATE TABLE "refresh_tokens" (
    "id"        TEXT         NOT NULL,
    "token"     TEXT         NOT NULL,
    "userId"    TEXT         NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey"      PRIMARY KEY ("id"),
    CONSTRAINT "refresh_tokens_token_key" UNIQUE ("token"),
    CONSTRAINT "refresh_tokens_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);


-- ─────────────────────────────────────────────
-- 3. ESTRUCTURA FÍSICA: estacionamiento → zona → puesto
-- ─────────────────────────────────────────────

-- Un estacionamiento del campus.
CREATE TABLE "parking_lots" (
    "id"          TEXT         NOT NULL,
    "name"        TEXT         NOT NULL,
    "code"        TEXT         NOT NULL,
    "description" TEXT,
    "location"    TEXT,
    "totalSpaces" INTEGER      NOT NULL DEFAULT 0,
    "isActive"    BOOLEAN      NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parking_lots_pkey"     PRIMARY KEY ("id"),
    CONSTRAINT "parking_lots_code_key" UNIQUE ("code")
);

-- Zona dentro de un estacionamiento (A, B, C...).
-- RESTRICT: no se puede borrar un estacionamiento que todavía tiene zonas.
CREATE TABLE "parking_zones" (
    "id"                TEXT             NOT NULL,
    "parkingLotId"      TEXT             NOT NULL,
    "name"              TEXT             NOT NULL,
    "code"              TEXT             NOT NULL,
    "description"       TEXT,
    "floor"             INTEGER          DEFAULT 1,
    "sortOrder"         INTEGER          NOT NULL DEFAULT 0,
    "isActive"          BOOLEAN          NOT NULL DEFAULT true,
    -- Categorías que pueden estacionarse aquí. Lista vacía = solo por reserva.
    "allowedCategories" "UserCategory"[],
    "createdAt"         TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3)     NOT NULL,

    CONSTRAINT "parking_zones_pkey"     PRIMARY KEY ("id"),
    CONSTRAINT "parking_zones_code_key" UNIQUE ("code"),
    CONSTRAINT "parking_zones_parkingLotId_fkey"
        FOREIGN KEY ("parkingLotId") REFERENCES "parking_lots"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Puesto individual. positionX/Y, width, height y rotation lo dibujan en el mapa.
CREATE TABLE "parking_spaces" (
    "id"           TEXT             NOT NULL,
    "zoneId"       TEXT             NOT NULL,
    "code"         TEXT             NOT NULL,
    "number"       INTEGER          NOT NULL,
    "type"         "SpaceType"      NOT NULL DEFAULT 'STANDARD',
    "status"       "SpaceStatus"    NOT NULL DEFAULT 'AVAILABLE',
    "isAccessible" BOOLEAN          NOT NULL DEFAULT false,
    "isCovered"    BOOLEAN          NOT NULL DEFAULT false,
    "priority"     INTEGER          NOT NULL DEFAULT 3,
    "positionX"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "positionY"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "width"        DOUBLE PRECISION NOT NULL DEFAULT 60,
    "height"       DOUBLE PRECISION NOT NULL DEFAULT 100,
    "rotation"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metadata"     JSONB,
    "createdAt"    TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3)     NOT NULL,

    CONSTRAINT "parking_spaces_pkey"     PRIMARY KEY ("id"),
    CONSTRAINT "parking_spaces_code_key" UNIQUE ("code"),
    CONSTRAINT "parking_spaces_zoneId_fkey"
        FOREIGN KEY ("zoneId") REFERENCES "parking_zones"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);


-- ─────────────────────────────────────────────
-- 4. OPERACIÓN
-- ─────────────────────────────────────────────

-- Visitante externo: no es usuario del sistema, entra con una reserva.
-- La cédula es única cuando se informa (varios NULL no chocan en PostgreSQL).
CREATE TABLE "visitors" (
    "id"           TEXT         NOT NULL,
    "firstName"    TEXT         NOT NULL,
    "lastName"     TEXT         NOT NULL,
    "documentId"   TEXT,
    "email"        TEXT,
    "phone"        TEXT,
    "organization" TEXT,
    "vehiclePlate" TEXT,
    "vehicleBrand" TEXT,
    "vehicleModel" TEXT,
    "vehicleColor" TEXT,
    "notes"        TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visitors_pkey"           PRIMARY KEY ("id"),
    CONSTRAINT "visitors_documentId_key" UNIQUE ("documentId")
);

-- Reserva administrativa de un puesto en un intervalo de tiempo.
-- Siempre la crea un administrador; el beneficiario puede ser un usuario
-- de la UJAP ("userId"), un visitante ("visitorId") o ninguno (un evento).
CREATE TABLE "reservations" (
    "id"                 TEXT                NOT NULL,
    "parkingSpaceId"     TEXT                NOT NULL,
    "createdByAdminId"   TEXT                NOT NULL,
    "visitorId"          TEXT,
    "userId"             TEXT,
    "title"              TEXT                NOT NULL,
    "description"        TEXT,
    "reservationType"    "ReservationType"   NOT NULL DEFAULT 'VISITOR',
    "startAt"            TIMESTAMP(3)        NOT NULL,
    "endAt"              TIMESTAMP(3)        NOT NULL,
    "status"             "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "priority"           INTEGER             NOT NULL DEFAULT 3,
    "vehiclePlate"       TEXT,
    "vehicleDescription" TEXT,
    "notes"              TEXT,
    "createdAt"          TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3)        NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reservations_end_after_start" CHECK ("endAt" > "startAt"),
    CONSTRAINT "reservations_parkingSpaceId_fkey"
        FOREIGN KEY ("parkingSpaceId") REFERENCES "parking_spaces"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "reservations_createdByAdminId_fkey"
        FOREIGN KEY ("createdByAdminId") REFERENCES "users"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "reservations_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "reservations_visitorId_fkey"
        FOREIGN KEY ("visitorId") REFERENCES "visitors"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

-- Sesión de estacionamiento: "el usuario X dejó el carro en el puesto Y".
-- Es la tabla intermedia de la relación muchos-a-muchos users ↔ parking_spaces.
CREATE TABLE "parking_sessions" (
    "id"             TEXT            NOT NULL,
    "userId"         TEXT            NOT NULL,
    "parkingSpaceId" TEXT            NOT NULL,
    "reservationId"  TEXT,
    "slot"           INTEGER         NOT NULL DEFAULT 1,
    "checkInAt"      TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOutAt"     TIMESTAMP(3),
    "status"         "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "source"         "SessionSource" NOT NULL DEFAULT 'WEB',
    "notes"          TEXT,
    "createdAt"      TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3)    NOT NULL,

    CONSTRAINT "parking_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "parking_sessions_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "parking_sessions_parkingSpaceId_fkey"
        FOREIGN KEY ("parkingSpaceId") REFERENCES "parking_spaces"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "parking_sessions_reservationId_fkey"
        FOREIGN KEY ("reservationId") REFERENCES "reservations"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

-- Bloqueo de un puesto por mantenimiento, pintura, obra, evento...
CREATE TABLE "maintenance_blocks" (
    "id"             TEXT                NOT NULL,
    "parkingSpaceId" TEXT                NOT NULL,
    "createdById"    TEXT                NOT NULL,
    "reason"         "MaintenanceReason" NOT NULL DEFAULT 'MAINTENANCE',
    "description"    TEXT,
    "startAt"        TIMESTAMP(3)        NOT NULL,
    "endAt"          TIMESTAMP(3)        NOT NULL,
    "status"         "MaintenanceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt"      TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3)        NOT NULL,

    CONSTRAINT "maintenance_blocks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "maintenance_blocks_parkingSpaceId_fkey"
        FOREIGN KEY ("parkingSpaceId") REFERENCES "parking_spaces"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "maintenance_blocks_createdById_fkey"
        FOREIGN KEY ("createdById") REFERENCES "users"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Bitácora de auditoría: toda escritura con éxito queda registrada (RN-011).
-- "entityId" no tiene FK a propósito: puede apuntar a cualquier tabla.
CREATE TABLE "audit_logs" (
    "id"         TEXT         NOT NULL,
    "userId"     TEXT         NOT NULL,
    "action"     TEXT         NOT NULL,
    "entityType" TEXT         NOT NULL,
    "entityId"   TEXT,
    "oldValue"   JSONB,
    "newValue"   JSONB,
    "ipAddress"  TEXT,
    "userAgent"  TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "audit_logs_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);


-- ─────────────────────────────────────────────
-- 5. REGLAS DE NEGOCIO QUE APLICA LA PROPIA BASE DE DATOS
-- ─────────────────────────────────────────────
-- Comprobarlas con un SELECT antes de insertar sería una condición de carrera:
-- dos peticiones simultáneas verían el puesto libre y lo ocuparían las dos.
-- Con estas restricciones, la segunda inserción falla siempre.

-- RN-001: un puesto no puede tener dos sesiones activas a la vez.
CREATE UNIQUE INDEX "parking_sessions_one_active_per_space"
    ON "parking_sessions" ("parkingSpaceId")
    WHERE "status" = 'ACTIVE';

-- RN-002: cada sesión activa de un usuario ocupa un cupo distinto (1, 2...).
-- El tope de cupos por categoría lo decide la aplicación al asignar "slot".
CREATE UNIQUE INDEX "parking_sessions_one_active_per_user_slot"
    ON "parking_sessions" ("userId", "slot")
    WHERE "status" = 'ACTIVE';

-- RN-006: dos reservas vigentes del mismo puesto no pueden solaparse.
-- Rango semiabierto '[)': 08:00-10:00 y 10:00-12:00 sí se permiten.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "reservations"
    ADD CONSTRAINT "reservations_no_overlap"
    EXCLUDE USING gist (
        "parkingSpaceId" WITH =,
        tsrange("startAt", "endAt", '[)') WITH &&
    )
    WHERE ("status" IN ('PENDING', 'CONFIRMED', 'ACTIVE'));


-- ─────────────────────────────────────────────
-- 6. ÍNDICES PARA LAS CONSULTAS FRECUENTES
-- ─────────────────────────────────────────────

CREATE INDEX "parking_spaces_status_idx"             ON "parking_spaces"("status");
CREATE INDEX "parking_spaces_zoneId_idx"             ON "parking_spaces"("zoneId");
CREATE INDEX "parking_sessions_userId_idx"           ON "parking_sessions"("userId");
CREATE INDEX "parking_sessions_parkingSpaceId_idx"   ON "parking_sessions"("parkingSpaceId");
CREATE INDEX "parking_sessions_status_idx"           ON "parking_sessions"("status");
CREATE INDEX "reservations_parkingSpaceId_idx"       ON "reservations"("parkingSpaceId");
CREATE INDEX "reservations_startAt_idx"              ON "reservations"("startAt");
CREATE INDEX "reservations_endAt_idx"                ON "reservations"("endAt");
CREATE INDEX "reservations_status_idx"               ON "reservations"("status");
CREATE INDEX "maintenance_blocks_parkingSpaceId_idx" ON "maintenance_blocks"("parkingSpaceId");
CREATE INDEX "maintenance_blocks_startAt_idx"        ON "maintenance_blocks"("startAt");
CREATE INDEX "maintenance_blocks_endAt_idx"          ON "maintenance_blocks"("endAt");
CREATE INDEX "audit_logs_userId_idx"                 ON "audit_logs"("userId");
CREATE INDEX "audit_logs_entityType_idx"             ON "audit_logs"("entityType");
CREATE INDEX "audit_logs_createdAt_idx"              ON "audit_logs"("createdAt");
