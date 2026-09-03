-- Fase 6.4.0
-- Ajuste explicito del modelo Donor para identidad canonica desde PayPal payer.
-- El proyecto actualmente usa TypeORM con synchronize=true, por lo que este script
-- debe aplicarse manualmente en ambientes compartidos antes de desplegar el cambio.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT lower(btrim(email)) AS normalized_email, count(*) AS total
      FROM "Donors"
      WHERE email IS NOT NULL
      GROUP BY lower(btrim(email))
      HAVING count(*) > 1
    ) collisions
  ) THEN
    RAISE EXCEPTION 'Existen Donors con emails que colisionan al normalizar lowercase/trim.';
  END IF;
END $$;

ALTER TABLE "Donors"
  ADD COLUMN IF NOT EXISTS "apellido" varchar(255);

UPDATE "Donors"
SET email = lower(btrim(email))
WHERE email IS NOT NULL
  AND email <> lower(btrim(email));

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = current_schema()
      AND t.relname = 'Donors'
      AND c.contype = 'u'
      AND (
        c.conkey = ARRAY[
          (SELECT attnum FROM pg_attribute WHERE attrelid = t.oid AND attname = 'telefono')
        ]
        OR c.conkey = ARRAY[
          (SELECT attnum FROM pg_attribute WHERE attrelid = t.oid AND attname = 'usuario_instagram')
        ]
      )
  LOOP
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', current_schema(), 'Donors', constraint_name);
  END LOOP;
END $$;

ALTER TABLE "Donors"
  ALTER COLUMN "telefono" DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = current_schema()
      AND t.relname = 'Donors'
      AND c.contype = 'u'
      AND c.conkey = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = t.oid AND attname = 'email')
      ]
  ) THEN
    ALTER TABLE "Donors"
      ADD CONSTRAINT "UQ_Donors_email" UNIQUE ("email");
  END IF;
END $$;

COMMIT;

-- Paso manual requerido después del despliegue:
-- 1. Backfill de apellido para Donors legacy que hoy solo tienen nombre completo.
-- 2. Validar que no existan filas con apellido NULL que deban quedar completas.
-- 3. Cuando el backfill este completo, ejecutar:
--      ALTER TABLE "Donors" ALTER COLUMN "apellido" SET NOT NULL;
