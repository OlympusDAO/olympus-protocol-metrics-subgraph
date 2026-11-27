\set ON_ERROR_STOP on

BEGIN;

DO $reset$
DECLARE
  standard_acl constant aclitem[] := ARRAY[
    '=U/pg_database_owner'::aclitem,
    'pg_database_owner=UC/pg_database_owner'::aclitem
  ];
  database_owner name;
  database_owner_grant aclitem;
  expected_acl aclitem[];
  phase text;
  actual_owner oid;
  actual_acl aclitem[];
BEGIN
  IF pg_catalog.to_regclass('public.envio_info') IS NULL THEN
    RAISE EXCEPTION 'No public.envio_info table in the connected database';
  END IF;

  SELECT rolname
  INTO STRICT database_owner
  FROM pg_catalog.pg_database AS db
  JOIN pg_catalog.pg_roles AS role ON role.oid = db.datdba
  WHERE db.datname = pg_catalog.current_database();
  database_owner_grant := pg_catalog.format('%I=UC/pg_database_owner', database_owner)::aclitem;

  -- Recheck after creation so ALTER DEFAULT PRIVILEGES cannot add grants silently.
  FOREACH phase IN ARRAY ARRAY['existing', 'recreated'] LOOP
    SELECT nspowner, ARRAY(
      SELECT item
      FROM pg_catalog.unnest(
        COALESCE(nspacl, pg_catalog.acldefault('n', nspowner))
      ) AS item
      ORDER BY item::text COLLATE pg_catalog."C"
    )
    INTO actual_owner, actual_acl
    FROM pg_catalog.pg_namespace
    WHERE nspname = 'public';

    IF phase = 'existing'
      AND pg_catalog.array_remove(actual_acl, database_owner_grant) = standard_acl THEN
      expected_acl := actual_acl;
    END IF;

    IF actual_owner IS DISTINCT FROM 'pg_database_owner'::pg_catalog.regrole
      OR expected_acl IS NULL
      OR actual_acl IS DISTINCT FROM expected_acl THEN
      RAISE EXCEPTION
        'Unsupported owner or ACL on % public schema. Use a separately reviewed restore.',
        phase
        USING DETAIL = pg_catalog.format('Owner: %s. ACL: %s.',
          actual_owner::pg_catalog.regrole, actual_acl);
    END IF;

    IF phase = 'existing' THEN
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public AUTHORIZATION pg_database_owner;
      GRANT USAGE ON SCHEMA public TO PUBLIC;
      IF database_owner_grant = ANY(expected_acl) THEN
        EXECUTE pg_catalog.format('GRANT USAGE, CREATE ON SCHEMA public TO %I', database_owner);
      END IF;
    END IF;
  END LOOP;
END;
$reset$;

COMMIT;
