import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Migration 7 — admin sessions, append-only audit, idempotency reservations and import batches. */
export class AdminOperations1758700000007 implements MigrationInterface {
  name = 'AdminOperations1758700000007';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE admin_session (
        id                  uuid PRIMARY KEY,
        user_id             uuid NOT NULL REFERENCES admin_user(id),
        token_hash          text NOT NULL,
        csrf_token          text NOT NULL,
        auth_version        integer NOT NULL,
        created_at          timestamptz NOT NULL DEFAULT now(),
        last_seen_at        timestamptz NOT NULL DEFAULT now(),
        idle_expires_at     timestamptz NOT NULL,
        absolute_expires_at timestamptz NOT NULL,
        revoked_at          timestamptz,
        CONSTRAINT admin_session_token_uk UNIQUE (token_hash)
      )
    `);
    await q.query(`CREATE INDEX admin_session_user_idx ON admin_session (user_id, revoked_at)`);

    await q.query(`
      CREATE TABLE audit_event (
        id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        actor_id    uuid REFERENCES admin_user(id),
        action      text NOT NULL,
        entity_type text NOT NULL,
        entity_id   text NOT NULL,
        created_at  timestamptz NOT NULL DEFAULT now(),
        before_hash text,
        after_hash  text,
        metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
        request_id  text,
        CONSTRAINT audit_event_action_chk CHECK (action ~ '^[A-Z_]{3,64}$'),
        CONSTRAINT audit_event_metadata_chk CHECK (jsonb_typeof(metadata) = 'object')
      )
    `);
    await q.query(`CREATE INDEX audit_entity_time_idx ON audit_event (entity_type, entity_id, created_at DESC)`);
    await q.query(`
      CREATE FUNCTION br_audit_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'audit_event is append-only' USING ERRCODE = 'integrity_constraint_violation';
      END $$
    `);
    await q.query(`CREATE TRIGGER audit_event_append_only BEFORE UPDATE OR DELETE ON audit_event FOR EACH ROW EXECUTE FUNCTION br_audit_append_only()`);

    await q.query(`
      CREATE TABLE admin_idempotency (
        actor_id        uuid NOT NULL REFERENCES admin_user(id),
        operation       text NOT NULL,
        idempotency_key text NOT NULL,
        request_hash    text NOT NULL,
        response_status integer NOT NULL,
        response_body   jsonb NOT NULL,
        created_at      timestamptz NOT NULL DEFAULT now(),
        expires_at      timestamptz NOT NULL,
        PRIMARY KEY (actor_id, operation, idempotency_key),
        CONSTRAINT admin_idempotency_key_chk CHECK (length(idempotency_key) BETWEEN 8 AND 128)
      )
    `);

    await q.query(`
      CREATE TABLE import_batch (
        id                     uuid PRIMARY KEY,
        actor_id               uuid NOT NULL REFERENCES admin_user(id),
        lottery_id             uuid REFERENCES lottery(id),
        draw_id                uuid REFERENCES draw(id),
        rule_version_id        uuid REFERENCES rule_version(id),
        format                 text NOT NULL,
        manifest               jsonb NOT NULL,
        raw_upload             bytea NOT NULL,
        upload_sha256          text NOT NULL,
        canonical_payload_hash text,
        status                 text NOT NULL,
        errors                 jsonb NOT NULL DEFAULT '[]'::jsonb,
        parsed_rows            jsonb NOT NULL DEFAULT '[]'::jsonb,
        summary                jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_revision_id    uuid REFERENCES result_revision(id),
        created_at             timestamptz NOT NULL DEFAULT now(),
        updated_at             timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT import_batch_format_chk CHECK (format IN ('csv', 'json')),
        CONSTRAINT import_batch_status_chk CHECK (status IN ('VALIDATION_FAILED', 'PREVIEW_READY', 'DRAFT_CREATED')),
        CONSTRAINT import_batch_size_chk CHECK (octet_length(raw_upload) <= 2097152),
        CONSTRAINT import_batch_revision_uk UNIQUE (created_revision_id)
      )
    `);
    await q.query(`CREATE INDEX import_batch_draw_idx ON import_batch (draw_id, created_at DESC)`);

    // Track who created a revision so the self-review policy can be enforced.
    await q.query(`ALTER TABLE result_revision ADD COLUMN created_by uuid REFERENCES admin_user(id)`);
    await q.query(`ALTER TABLE result_revision ADD COLUMN last_edited_by uuid REFERENCES admin_user(id)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE result_revision DROP COLUMN last_edited_by`);
    await q.query(`ALTER TABLE result_revision DROP COLUMN created_by`);
    await q.query(`DROP TABLE import_batch`);
    await q.query(`DROP TABLE admin_idempotency`);
    await q.query(`DROP TRIGGER audit_event_append_only ON audit_event`);
    await q.query(`DROP FUNCTION br_audit_append_only()`);
    await q.query(`DROP TABLE audit_event`);
    await q.query(`DROP TABLE admin_session`);
  }
}
