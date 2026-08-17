-- Zonas por categoría de usuario.
--
-- `Role` decide QUÉ puede hacer alguien (USER o ADMIN); `UserCategory` decide
-- DÓNDE puede estacionarse. Son ejes distintos: un administrador del sistema
-- sigue siendo, físicamente, personal administrativo.

-- CreateEnum
CREATE TYPE "UserCategory" AS ENUM ('STUDENT', 'PROFESSOR', 'STAFF');

-- AlterTable
ALTER TABLE "parking_zones" ADD COLUMN "allowedCategories" "UserCategory"[];

-- AlterTable
ALTER TABLE "users" ADD COLUMN "category" "UserCategory" NOT NULL DEFAULT 'STUDENT';

-- Reparto acordado del campus. Sin este relleno la columna quedaría vacía en
-- todas las zonas, que significa "solo por reserva", y nadie podría
-- estacionarse en ningún sitio.
UPDATE "parking_zones" SET "allowedCategories" = ARRAY['STUDENT']::"UserCategory"[]
  WHERE "code" IN ('A', 'B', 'C', 'D');

UPDATE "parking_zones" SET "allowedCategories" = ARRAY['PROFESSOR']::"UserCategory"[]
  WHERE "code" IN ('E', 'F', 'G');

UPDATE "parking_zones" SET "allowedCategories" = ARRAY['STAFF']::"UserCategory"[]
  WHERE "code" = 'H';

-- I y J quedan con la lista vacía a propósito: son de reserva exclusiva para
-- autoridades, proveedores y eventos.

-- El administrador del seed es personal administrativo
UPDATE "users" SET "category" = 'STAFF' WHERE "role" = 'ADMIN';
