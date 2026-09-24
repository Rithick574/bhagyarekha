import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 1 — deployment metadata singleton and admin users.
 * deployment_metadata is initialised by `pnpm env:init`, never by a migration,
 * so that a migration alone can never turn a database into a demo or live one.
 */
export class FoundationMetadataAdmin1758700000001 implements MigrationInterface {
  name = 'FoundationMetadataAdmin1758700000001';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE deployment_metadata (
        id             smallint PRIMARY KEY,
        data_mode      text NOT NULL,
        initialized_at timestamptz NOT NULL DEFAULT now(),
        note           text,
        CONSTRAINT deployment_metadata_singleton CHECK (id = 1),
        CONSTRAINT deployment_metadata_mode_chk CHECK (data_mode IN ('demo', 'live'))
      )
    `);
    // The mode of an initialised database can never be flipped in place.
    await q.query(`
      CREATE FUNCTION br_forbid_mode_change() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          RAISE EXCEPTION 'deployment_metadata cannot be deleted; create a new database for a different mode'
            USING ERRCODE = 'integrity_constraint_violation';
        END IF;
        IF NEW.data_mode IS DISTINCT FROM OLD.data_mode THEN
          RAISE EXCEPTION 'deployment_metadata.data_mode is immutable (was %, attempted %)', OLD.data_mode, NEW.data_mode
            USING ERRCODE = 'integrity_constraint_violation';
        END IF;
        RETURN NEW;
      END $$
    `);
    await q.query(`
      CREATE TRIGGER deployment_metadata_immutable
      BEFORE UPDATE OR DELETE ON deployment_metadata
      FOR EACH ROW EXECUTE FUNCTION br_forbid_mode_change()
    `);

    await q.query(`
      CREATE TABLE admin_user (
        id            uuid PRIMARY KEY,
        email         text NOT NULL,
        password_hash text NOT NULL,
        role          text NOT NULL,
        disabled      boolean NOT NULL DEFAULT false,
        auth_version  integer NOT NULL DEFAULT 1,
        created_at    timestamptz NOT NULL DEFAULT now(),
        updated_at    timestamptz NOT NULL DEFAULT now(),
        edit_version  integer NOT NULL DEFAULT 1,
        CONSTRAINT admin_user_email_lower_chk CHECK (email = lower(btrim(email)) AND email <> ''),
        CONSTRAINT admin_user_role_chk CHECK (role IN ('EDITOR', 'PUBLISHER'))
      )
    `);
    await q.query(`CREATE UNIQUE INDEX admin_user_email_uidx ON admin_user (email)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE admin_user`);
    await q.query(`DROP TRIGGER deployment_metadata_immutable ON deployment_metadata`);
    await q.query(`DROP FUNCTION br_forbid_mode_change()`);
    await q.query(`DROP TABLE deployment_metadata`);
  }
}
