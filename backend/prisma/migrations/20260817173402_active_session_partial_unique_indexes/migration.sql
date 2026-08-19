-- RN-001 y RN-002 aplicadas por la base de datos, no por la aplicación.
--
-- Sección 25: validar con un SELECT y después escribir es una condición de
-- carrera. Estos índices únicos parciales hacen imposible que existan dos
-- sesiones activas del mismo usuario, o dos sobre el mismo puesto, sin
-- importar cuántas peticiones lleguen a la vez.
--
-- Prisma no puede representar índices parciales en schema.prisma, así que se
-- crean con SQL. Ver la nota en el modelo ParkingSession: un futuro
-- `prisma migrate dev` podría proponer eliminarlos; hay que conservarlos.

-- RN-002: un usuario no puede tener más de una sesión activa
CREATE UNIQUE INDEX "parking_sessions_one_active_per_user"
  ON "parking_sessions" ("userId")
  WHERE "status" = 'ACTIVE';

-- RN-001: un puesto no puede tener más de una ocupación activa simultánea
CREATE UNIQUE INDEX "parking_sessions_one_active_per_space"
  ON "parking_sessions" ("parkingSpaceId")
  WHERE "status" = 'ACTIVE';
