-- RN-006 aplicada por la base de datos: dos reservas vigentes del mismo puesto
-- no pueden solaparse en el tiempo.
--
-- Igual que con las sesiones, comprobar el solapamiento con un SELECT y después
-- insertar sería una condición de carrera (sección 25). Una restricción
-- EXCLUDE lo resuelve dentro del propio motor.
--
-- El rango es SEMIABIERTO '[)': el fin de una reserva puede coincidir con el
-- inicio de la siguiente. Es exactamente la política de la sección 44:
--   08:00-10:00 + 09:00-11:00  → rechazado (se solapan)
--   08:00-10:00 + 10:00-12:00  → permitido (consecutivas)
--
-- Solo aplica a reservas vigentes: las CANCELLED, COMPLETED y NO_SHOW ya no
-- ocupan el puesto y deben poder convivir con una reserva nueva.
--
-- Prisma no puede expresar restricciones EXCLUDE en schema.prisma, así que va
-- en SQL. Ver la nota en el modelo Reservation: si `prisma migrate dev`
-- propone eliminarla, no aceptar.

-- Necesaria para combinar igualdad (uuid) con solapamiento (rango) en un GiST
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_no_overlap"
  EXCLUDE USING gist (
    "parkingSpaceId" WITH =,
    tsrange("startAt", "endAt", '[)') WITH &&
  )
  WHERE ("status" IN ('PENDING', 'CONFIRMED', 'ACTIVE'));

-- Coherencia básica del intervalo: sin ella, una reserva con fin anterior al
-- inicio crearía un rango vacío que jamás se solapa con nada.
ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_end_after_start"
  CHECK ("endAt" > "startAt");
