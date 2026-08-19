-- Varias sesiones activas por usuario, con tope aplicado por la base de datos.
--
-- RN-002 pasa de "una sesión activa" a "N sesiones activas según la categoría"
-- (un estudiante puede necesitar dos: coche y moto, o un vehículo compartido).
--
-- El tope NO se aplica contando sesiones en la aplicación: dos peticiones
-- simultáneas verían el mismo recuento y crearían una de más. En su lugar cada
-- sesión ocupa un CUPO numerado (1, 2, ...) y el índice único impide que dos
-- sesiones activas del mismo usuario compartan cupo. Con un tope de 2 solo
-- existen los cupos 1 y 2, así que es imposible pasar de ahí.

ALTER TABLE "parking_sessions" ADD COLUMN "slot" INTEGER NOT NULL DEFAULT 1;

-- El índice anterior permitía exactamente una sesión activa por usuario
DROP INDEX IF EXISTS "parking_sessions_one_active_per_user";

CREATE UNIQUE INDEX "parking_sessions_one_active_per_user_slot"
  ON "parking_sessions" ("userId", "slot")
  WHERE "status" = 'ACTIVE';

-- El de puesto no cambia: un puesto sigue admitiendo una sola ocupación (RN-001)
