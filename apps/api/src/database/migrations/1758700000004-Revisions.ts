import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Migration 4 — result revisions, per-category manifests, winning entries and revision evidence. */
export class Revisions1758700000004 implements MigrationInterface {
  name = 'Revisions1758700000004';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE result_revision (
        id                   uuid PRIMARY KEY,
        draw_id              uuid NOT NULL,
        lottery_id           uuid NOT NULL,
        rule_version_id      uuid NOT NULL,
        revision_no          integer NOT NULL,
        draw_snapshot        jsonb NOT NULL,
        based_on_revision_id uuid,
        workflow_state       text NOT NULL DEFAULT 'DRAFT',
        publication_kind     text NOT NULL,
        completeness         text NOT NULL,
        content_hash         text NOT NULL,
        reviewed_hash        text,
        reviewed_by          uuid REFERENCES admin_user(id),
        reviewed_at          timestamptz,
        published_by         uuid REFERENCES admin_user(id),
        published_at         timestamptz,
        correction_reason    text,
        created_at           timestamptz NOT NULL DEFAULT now(),
        updated_at           timestamptz NOT NULL DEFAULT now(),
        edit_version         integer NOT NULL DEFAULT 1,
        CONSTRAINT result_revision_draw_no_uk UNIQUE (draw_id, revision_no),
        CONSTRAINT result_revision_id_draw_uk UNIQUE (id, draw_id),
        CONSTRAINT result_revision_id_rule_uk UNIQUE (id, rule_version_id),
        -- Same-lottery integrity through composite foreign keys.
        CONSTRAINT result_revision_draw_fk FOREIGN KEY (draw_id, lottery_id) REFERENCES draw(id, lottery_id),
        CONSTRAINT result_revision_rule_fk FOREIGN KEY (rule_version_id, lottery_id) REFERENCES rule_version(id, lottery_id),
        CONSTRAINT result_revision_based_on_fk FOREIGN KEY (based_on_revision_id, draw_id) REFERENCES result_revision(id, draw_id),
        CONSTRAINT result_revision_state_chk CHECK (workflow_state IN ('DRAFT', 'READY', 'PUBLISHED', 'SUPERSEDED')),
        CONSTRAINT result_revision_kind_chk CHECK (publication_kind IN ('INITIAL', 'UPDATE', 'CORRECTION')),
        CONSTRAINT result_revision_completeness_chk CHECK (completeness IN ('PARTIAL', 'COMPLETE')),
        CONSTRAINT result_revision_revision_no_chk CHECK (revision_no >= 1),
        CONSTRAINT result_revision_based_on_chk CHECK (
          (publication_kind = 'INITIAL' AND based_on_revision_id IS NULL)
          OR (publication_kind <> 'INITIAL' AND based_on_revision_id IS NOT NULL)
        ),
        CONSTRAINT result_revision_not_self_chk CHECK (based_on_revision_id IS NULL OR based_on_revision_id <> id),
        CONSTRAINT result_revision_correction_reason_chk CHECK (publication_kind <> 'CORRECTION' OR (correction_reason IS NOT NULL AND btrim(correction_reason) <> '')),
        CONSTRAINT result_revision_published_chk CHECK (workflow_state NOT IN ('PUBLISHED', 'SUPERSEDED') OR published_at IS NOT NULL),
        CONSTRAINT result_revision_snapshot_chk CHECK (jsonb_typeof(draw_snapshot) = 'object' AND draw_snapshot ? 'drawCode')
      )
    `);

    await q.query(`
      CREATE TABLE revision_category (
        revision_id         uuid NOT NULL,
        category_code       text NOT NULL,
        rule_version_id     uuid NOT NULL,
        state               text NOT NULL DEFAULT 'MISSING',
        amount_minor        bigint,
        source_reviewed_by  uuid REFERENCES admin_user(id),
        source_reviewed_at  timestamptz,
        source_review_note  text,
        PRIMARY KEY (revision_id, category_code),
        CONSTRAINT revision_category_revision_rule_fk FOREIGN KEY (revision_id, rule_version_id) REFERENCES result_revision(id, rule_version_id) ON DELETE RESTRICT,
        CONSTRAINT revision_category_rule_category_fk FOREIGN KEY (rule_version_id, category_code) REFERENCES rule_category(rule_version_id, code) ON DELETE RESTRICT,
        CONSTRAINT revision_category_state_chk CHECK (state IN ('MISSING', 'PARTIAL', 'COMPLETE')),
        CONSTRAINT revision_category_amount_chk CHECK (amount_minor IS NULL OR amount_minor >= 0)
      )
    `);

    await q.query(`
      CREATE TABLE winning_entry (
        id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        revision_id   uuid NOT NULL,
        category_code text NOT NULL,
        series        varchar(8) NOT NULL DEFAULT '',
        number        varchar(12) NOT NULL,
        source_row    integer,
        CONSTRAINT winning_entry_category_fk FOREIGN KEY (revision_id, category_code) REFERENCES revision_category(revision_id, category_code) ON DELETE RESTRICT,
        CONSTRAINT winning_entry_uk UNIQUE (revision_id, category_code, series, number),
        CONSTRAINT winning_entry_number_chk CHECK (number ~ '^[0-9]{1,12}$'),
        CONSTRAINT winning_entry_series_chk CHECK (series ~ '^[A-Z]{0,8}$')
      )
    `);

    await q.query(`
      CREATE TABLE revision_evidence (
        revision_id uuid NOT NULL REFERENCES result_revision(id) ON DELETE RESTRICT,
        evidence_id uuid NOT NULL REFERENCES source_evidence(id) ON DELETE RESTRICT,
        PRIMARY KEY (revision_id, evidence_id)
      )
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE revision_evidence`);
    await q.query(`DROP TABLE winning_entry`);
    await q.query(`DROP TABLE revision_category`);
    await q.query(`DROP TABLE result_revision`);
  }
}
