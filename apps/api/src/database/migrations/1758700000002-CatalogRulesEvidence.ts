import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Migration 2 — lotteries, versioned rule definitions and source evidence. */
export class CatalogRulesEvidence1758700000002 implements MigrationInterface {
  name = 'CatalogRulesEvidence1758700000002';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE lottery (
        id               uuid PRIMARY KEY,
        code             text NOT NULL,
        slug             text NOT NULL,
        name_en          text NOT NULL,
        name_ml          text NOT NULL,
        active           boolean NOT NULL DEFAULT true,
        dataset_version  bigint NOT NULL DEFAULT 0,
        archive_coverage text NOT NULL DEFAULT 'UNKNOWN',
        created_at       timestamptz NOT NULL DEFAULT now(),
        updated_at       timestamptz NOT NULL DEFAULT now(),
        edit_version     integer NOT NULL DEFAULT 1,
        CONSTRAINT lottery_code_uk UNIQUE (code),
        CONSTRAINT lottery_slug_uk UNIQUE (slug),
        CONSTRAINT lottery_code_chk CHECK (code ~ '^[A-Z0-9_]{1,32}$'),
        CONSTRAINT lottery_slug_chk CHECK (slug ~ '^[a-z0-9-]{1,64}$'),
        CONSTRAINT lottery_coverage_chk CHECK (archive_coverage IN ('UNKNOWN', 'CURATED_COMPLETE'))
      )
    `);

    await q.query(`
      CREATE TABLE source_evidence (
        id            uuid PRIMARY KEY,
        kind          text NOT NULL,
        url           text,
        title         text NOT NULL,
        document_hash text,
        reviewed_by   uuid REFERENCES admin_user(id),
        reviewed_at   timestamptz,
        review_note   text,
        acquired_at   timestamptz,
        created_at    timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT source_evidence_kind_chk CHECK (kind IN ('OFFICIAL_DOCUMENT', 'MANUAL_TRANSCRIPTION', 'SYNTHETIC_FIXTURE')),
        CONSTRAINT source_evidence_url_chk CHECK (url IS NULL OR url ~ '^https://[^\\s@]+$'),
        CONSTRAINT source_evidence_title_chk CHECK (btrim(title) <> ''),
        -- A synthetic fixture can never point at a real document.
        CONSTRAINT source_evidence_synthetic_no_url_chk CHECK (kind <> 'SYNTHETIC_FIXTURE' OR (url IS NULL AND document_hash IS NULL))
      )
    `);

    await q.query(`
      CREATE TABLE rule_version (
        id                   uuid PRIMARY KEY,
        lottery_id           uuid NOT NULL REFERENCES lottery(id),
        version              integer NOT NULL,
        schema_version       integer NOT NULL,
        engine_version       text NOT NULL,
        number_length        integer NOT NULL,
        allowed_first_digits text[] NOT NULL,
        allowed_series       text[] NOT NULL,
        award_policy         text NOT NULL,
        state                text NOT NULL DEFAULT 'DRAFT',
        content_hash         text NOT NULL,
        approved_by          uuid REFERENCES admin_user(id),
        approved_at          timestamptz,
        approval_note        text,
        revoked_by           uuid REFERENCES admin_user(id),
        revoked_at           timestamptz,
        revocation_reason    text,
        created_at           timestamptz NOT NULL DEFAULT now(),
        updated_at           timestamptz NOT NULL DEFAULT now(),
        edit_version         integer NOT NULL DEFAULT 1,
        CONSTRAINT rule_version_lottery_version_uk UNIQUE (lottery_id, version),
        CONSTRAINT rule_version_id_lottery_uk UNIQUE (id, lottery_id),
        CONSTRAINT rule_version_number_length_chk CHECK (number_length BETWEEN 1 AND 12),
        CONSTRAINT rule_version_state_chk CHECK (state IN ('DRAFT', 'APPROVED', 'REVOKED')),
        CONSTRAINT rule_version_engine_chk CHECK (engine_version IN ('v1')),
        CONSTRAINT rule_version_policy_chk CHECK (award_policy IN ('SINGLE_BY_PRIORITY')),
        CONSTRAINT rule_version_domains_chk CHECK (cardinality(allowed_first_digits) >= 1 AND cardinality(allowed_series) >= 1),
        CONSTRAINT rule_version_revocation_reason_chk CHECK (state <> 'REVOKED' OR (revocation_reason IS NOT NULL AND btrim(revocation_reason) <> ''))
      )
    `);

    await q.query(`
      CREATE TABLE rule_category (
        rule_version_id      uuid NOT NULL REFERENCES rule_version(id),
        code                 text NOT NULL,
        label_en             text NOT NULL,
        label_ml             text NOT NULL,
        priority             integer NOT NULL,
        metric_role          text NOT NULL,
        match_kind           text NOT NULL,
        series_policy        text NOT NULL,
        suffix_length        integer,
        excluded_by          text[] NOT NULL DEFAULT '{}',
        expected_entry_count integer,
        PRIMARY KEY (rule_version_id, code),
        CONSTRAINT rule_category_priority_uk UNIQUE (rule_version_id, priority),
        CONSTRAINT rule_category_code_chk CHECK (code ~ '^[A-Z0-9_]{1,32}$'),
        CONSTRAINT rule_category_priority_chk CHECK (priority >= 1),
        CONSTRAINT rule_category_metric_chk CHECK (metric_role IN ('FIRST_PRIZE', 'OTHER')),
        CONSTRAINT rule_category_match_chk CHECK (
          (match_kind = 'FULL_NUMBER' AND series_policy IN ('MATCH_ENTRY', 'EXCEPT_ENTRY', 'ANY_ALLOWED') AND suffix_length IS NULL)
          OR (match_kind = 'SUFFIX' AND series_policy = 'ANY_ALLOWED' AND suffix_length BETWEEN 1 AND 12)
        ),
        CONSTRAINT rule_category_expected_chk CHECK (expected_entry_count IS NULL OR expected_entry_count >= 0)
      )
    `);

    await q.query(`
      CREATE TABLE rule_evidence (
        rule_version_id uuid NOT NULL REFERENCES rule_version(id) ON DELETE RESTRICT,
        evidence_id     uuid NOT NULL REFERENCES source_evidence(id) ON DELETE RESTRICT,
        PRIMARY KEY (rule_version_id, evidence_id)
      )
    `);

    // Approved/revoked rule content is immutable. Only DRAFT content may change.
    await q.query(`
      CREATE FUNCTION br_guard_rule_version() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          IF OLD.state <> 'DRAFT' THEN
            RAISE EXCEPTION 'rule_version % is % and cannot be deleted', OLD.id, OLD.state USING ERRCODE = 'integrity_constraint_violation';
          END IF;
          RETURN OLD;
        END IF;
        IF OLD.state <> 'DRAFT' THEN
          IF NEW.lottery_id IS DISTINCT FROM OLD.lottery_id OR NEW.version IS DISTINCT FROM OLD.version
             OR NEW.schema_version IS DISTINCT FROM OLD.schema_version OR NEW.engine_version IS DISTINCT FROM OLD.engine_version
             OR NEW.number_length IS DISTINCT FROM OLD.number_length OR NEW.allowed_first_digits IS DISTINCT FROM OLD.allowed_first_digits
             OR NEW.allowed_series IS DISTINCT FROM OLD.allowed_series OR NEW.award_policy IS DISTINCT FROM OLD.award_policy
             OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
             OR NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
            RAISE EXCEPTION 'rule_version % is % and its content is immutable', OLD.id, OLD.state USING ERRCODE = 'integrity_constraint_violation';
          END IF;
          IF NOT (NEW.state = OLD.state OR (OLD.state = 'APPROVED' AND NEW.state = 'REVOKED')) THEN
            RAISE EXCEPTION 'rule_version % cannot move from % to %', OLD.id, OLD.state, NEW.state USING ERRCODE = 'integrity_constraint_violation';
          END IF;
        END IF;
        RETURN NEW;
      END $$
    `);
    await q.query(`
      CREATE TRIGGER rule_version_guard BEFORE UPDATE OR DELETE ON rule_version
      FOR EACH ROW EXECUTE FUNCTION br_guard_rule_version()
    `);
    await q.query(`
      CREATE FUNCTION br_guard_rule_category() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE parent_state text;
      BEGIN
        SELECT state INTO parent_state FROM rule_version WHERE id = COALESCE(NEW.rule_version_id, OLD.rule_version_id);
        IF parent_state IS DISTINCT FROM 'DRAFT' THEN
          RAISE EXCEPTION 'rule_category rows of a % rule version are immutable', parent_state USING ERRCODE = 'integrity_constraint_violation';
        END IF;
        RETURN COALESCE(NEW, OLD);
      END $$
    `);
    await q.query(`
      CREATE TRIGGER rule_category_guard BEFORE INSERT OR UPDATE OR DELETE ON rule_category
      FOR EACH ROW EXECUTE FUNCTION br_guard_rule_category()
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TRIGGER rule_category_guard ON rule_category`);
    await q.query(`DROP FUNCTION br_guard_rule_category()`);
    await q.query(`DROP TRIGGER rule_version_guard ON rule_version`);
    await q.query(`DROP FUNCTION br_guard_rule_version()`);
    await q.query(`DROP TABLE rule_evidence`);
    await q.query(`DROP TABLE rule_category`);
    await q.query(`DROP TABLE rule_version`);
    await q.query(`DROP TABLE source_evidence`);
    await q.query(`DROP TABLE lottery`);
  }
}
