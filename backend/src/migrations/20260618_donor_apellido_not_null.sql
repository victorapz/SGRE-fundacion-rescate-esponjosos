-- Fase 6.4.0
-- Migracion complementaria para endurecer Donors.apellido como obligatorio.
-- Ejecutar con el backend detenido. No confiar en synchronize=true para este cambio.
--
-- Consulta diagnostica previa recomendada:
-- SELECT
--   donante_id,
--   email,
--   nombre,
--   apellido
-- FROM "Donors"
-- WHERE "apellido" IS NULL
--    OR BTRIM("apellido") = '';

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Donors'
      AND column_name = 'apellido'
  ) THEN
    RAISE EXCEPTION 'No existe la columna Donors.apellido. Ejecuta primero la migracion 20260618_donor_paypal_identity.sql.';
  END IF;
END $$;

UPDATE "Donors"
SET "apellido" = NULLIF(BTRIM("apellido"), '')
WHERE "apellido" IS NULL
   OR "apellido" <> NULLIF(BTRIM("apellido"), '');

DO $$
DECLARE
  unresolved_count integer;
BEGIN
  SELECT COUNT(*)
  INTO unresolved_count
  FROM "Donors"
  WHERE "apellido" IS NULL;

  IF unresolved_count > 0 THEN
    RAISE EXCEPTION
      'No se puede aplicar NOT NULL a Donors.apellido: existen % registros sin apellido.',
      unresolved_count;
  END IF;
END $$;

ALTER TABLE "Donors"
  ALTER COLUMN "apellido" SET NOT NULL;

COMMIT;
