-- La cédula identifica a la persona: dos fichas con el mismo documento serían
-- visitantes duplicados que el administrador no puede distinguir al buscar
-- (sección 59, riesgo 5).
--
-- En PostgreSQL varios NULL no colisionan en un índice único, así que el campo
-- sigue siendo opcional para visitantes de los que solo se conoce el nombre.

-- CreateIndex
CREATE UNIQUE INDEX "visitors_documentId_key" ON "visitors"("documentId");
