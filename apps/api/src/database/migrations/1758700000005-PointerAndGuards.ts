import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 5 — current-revision pointer FK and database immutability guards.
 * Published payloads are never edited in place (INV-04). The guards are a
 * backstop for the transactional service layer, not a replacement for it.
 */
export class PointerAndGuards1758700000005 implements MigrationInterface {
  name = 'PointerAndGuards1758700000005';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE draw
      ADD CONSTRAINT draw_current_revision_fk
      FOREIGN KEY (current_revision_id, id) REFERENCES result_revision(id, draw_id)
    `);

    await q.query(`
      CREATE FUNCTION br_guard_result_revision() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          IF OLD.workflow_state IN ('PUBLISHED', 'SUPERSEDED') THEN
            RAISE EXCEPTION 'result_revision % is % and cannot be deleted', OLD.id, OLD.workflow_state USING ERRCODE = 'integrity_constraint_violation';
          END IF;
          RETURN OLD;
        END IF;
        -- Identity never changes after creation.
        IF NEW.draw_id IS DISTINCT FROM OLD.draw_id OR NEW.lottery_id IS DISTINCT FROM OLD.lottery_id
           OR NEW.rule_version_id IS DISTINCT FROM OLD.rule_version_id OR NEW.revision_no IS DISTINCT FROM OLD.revision_no
           OR NEW.based_on_revision_id IS DISTINCT FROM OLD.based_on_revision_id THEN
          RAISE EXCEPTION 'result_revision % identity is immutable', OLD.id USING ERRCODE = 'integrity_constraint_violation';
        END IF;
        IF OLD.workflow_state IN ('PUBLISHED', 'SUPERSEDED') THEN
          IF NEW.draw_snapshot IS DISTINCT FROM OLD.draw_snapshot OR NEW.publication_kind IS DISTINCT FROM OLD.publication_kind
             OR NEW.completeness IS DISTINCT FROM OLD.completeness OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
             OR NEW.reviewed_hash IS DISTINCT FROM OLD.reviewed_hash OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
             OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at OR NEW.published_by IS DISTINCT FROM OLD.published_by
             OR NEW.published_at IS DISTINCT FROM OLD.published_at OR NEW.correction_reason IS DISTINCT FROM OLD.correction_reason THEN
            RAISE EXCEPTION 'result_revision % is % and its payload is immutable', OLD.id, OLD.workflow_state USING ERRCODE = 'integrity_constraint_violation';
          END IF;
          IF NOT (NEW.workflow_state = OLD.workflow_state OR (OLD.workflow_state = 'PUBLISHED' AND NEW.workflow_state = 'SUPERSEDED')) THEN
            RAISE EXCEPTION 'result_revision % cannot move from % to %', OLD.id, OLD.workflow_state, NEW.workflow_state USING ERRCODE = 'integrity_constraint_violation';
          END IF;
        END IF;
        RETURN NEW;
      END $$
    `);
    await q.query(`
      CREATE TRIGGER result_revision_guard BEFORE UPDATE OR DELETE ON result_revision
      FOR EACH ROW EXECUTE FUNCTION br_guard_result_revision()
    `);

    await q.query(`
      CREATE FUNCTION br_guard_revision_payload() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE parent_state text;
      BEGIN
        SELECT workflow_state INTO parent_state FROM result_revision WHERE id = COALESCE(NEW.revision_id, OLD.revision_id);
        IF parent_state IS DISTINCT FROM 'DRAFT' THEN
          RAISE EXCEPTION '% rows of a % revision are immutable', TG_TABLE_NAME, COALESCE(parent_state, 'missing') USING ERRCODE = 'integrity_constraint_violation';
        END IF;
        RETURN COALESCE(NEW, OLD);
      END $$
    `);
    await q.query(`
      CREATE TRIGGER winning_entry_guard BEFORE INSERT OR UPDATE OR DELETE ON winning_entry
      FOR EACH ROW EXECUTE FUNCTION br_guard_revision_payload()
    `);
    await q.query(`
      CREATE TRIGGER revision_category_guard BEFORE INSERT OR UPDATE OR DELETE ON revision_category
      FOR EACH ROW EXECUTE FUNCTION br_guard_revision_payload()
    `);
    await q.query(`
      CREATE TRIGGER revision_evidence_guard BEFORE INSERT OR UPDATE OR DELETE ON revision_evidence
      FOR EACH ROW EXECUTE FUNCTION br_guard_revision_payload()
    `);

    // Evidence referenced by approved rules or published revisions is immutable.
    await q.query(`
      CREATE FUNCTION br_guard_source_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE referenced boolean;
      BEGIN
        SELECT EXISTS (
          SELECT 1 FROM revision_evidence re JOIN result_revision r ON r.id = re.revision_id
          WHERE re.evidence_id = OLD.id AND r.workflow_state IN ('PUBLISHED', 'SUPERSEDED')
        ) OR EXISTS (
          SELECT 1 FROM rule_evidence re JOIN rule_version rv ON rv.id = re.rule_version_id
          WHERE re.evidence_id = OLD.id AND rv.state <> 'DRAFT'
        ) INTO referenced;
        IF referenced THEN
          RAISE EXCEPTION 'source_evidence % is referenced by published or approved content and is immutable', OLD.id USING ERRCODE = 'integrity_constraint_violation';
        END IF;
        RETURN COALESCE(NEW, OLD);
      END $$
    `);
    await q.query(`
      CREATE TRIGGER source_evidence_guard BEFORE UPDATE OR DELETE ON source_evidence
      FOR EACH ROW EXECUTE FUNCTION br_guard_source_evidence()
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TRIGGER source_evidence_guard ON source_evidence`);
    await q.query(`DROP FUNCTION br_guard_source_evidence()`);
    await q.query(`DROP TRIGGER revision_evidence_guard ON revision_evidence`);
    await q.query(`DROP TRIGGER revision_category_guard ON revision_category`);
    await q.query(`DROP TRIGGER winning_entry_guard ON winning_entry`);
    await q.query(`DROP FUNCTION br_guard_revision_payload()`);
    await q.query(`DROP TRIGGER result_revision_guard ON result_revision`);
    await q.query(`DROP FUNCTION br_guard_result_revision()`);
    await q.query(`ALTER TABLE draw DROP CONSTRAINT draw_current_revision_fk`);
  }
}
