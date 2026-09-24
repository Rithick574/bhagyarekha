import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Migration 3 — draws with stable (lottery, draw_code) identity and IST-consistent dates. */
export class Draws1758700000003 implements MigrationInterface {
  name = 'Draws1758700000003';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE draw (
        id                  uuid PRIMARY KEY,
        lottery_id          uuid NOT NULL REFERENCES lottery(id),
        draw_code           text NOT NULL,
        scheduled_date      date,
        actual_date         date,
        scheduled_at        timestamptz,
        actual_at           timestamptz,
        phase               text NOT NULL DEFAULT 'SCHEDULED',
        visibility          text NOT NULL DEFAULT 'ACTIVE',
        suspension_reason   text,
        current_revision_id uuid,
        next_revision_no    integer NOT NULL DEFAULT 1,
        created_at          timestamptz NOT NULL DEFAULT now(),
        updated_at          timestamptz NOT NULL DEFAULT now(),
        edit_version        integer NOT NULL DEFAULT 1,
        CONSTRAINT draw_lottery_code_uk UNIQUE (lottery_id, draw_code),
        CONSTRAINT draw_id_lottery_uk UNIQUE (id, lottery_id),
        CONSTRAINT draw_code_chk CHECK (draw_code ~ '^[A-Za-z0-9_.-]{1,32}$'),
        CONSTRAINT draw_phase_chk CHECK (phase IN ('SCHEDULED', 'POSTPONED', 'HELD', 'CANCELLED')),
        CONSTRAINT draw_visibility_chk CHECK (visibility IN ('ACTIVE', 'SUSPENDED')),
        CONSTRAINT draw_suspension_reason_chk CHECK (visibility <> 'SUSPENDED' OR (suspension_reason IS NOT NULL AND btrim(suspension_reason) <> '')),
        CONSTRAINT draw_some_date_chk CHECK (scheduled_date IS NOT NULL OR actual_date IS NOT NULL),
        -- An instant and its local date must agree in IST. Midnight is never synthesised.
        CONSTRAINT draw_scheduled_ist_chk CHECK (scheduled_at IS NULL OR scheduled_date IS NULL OR (scheduled_at AT TIME ZONE 'Asia/Kolkata')::date = scheduled_date),
        CONSTRAINT draw_actual_ist_chk CHECK (actual_at IS NULL OR actual_date IS NULL OR (actual_at AT TIME ZONE 'Asia/Kolkata')::date = actual_date),
        CONSTRAINT draw_actual_requires_date_chk CHECK (actual_at IS NULL OR actual_date IS NOT NULL)
      )
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE draw`);
  }
}
