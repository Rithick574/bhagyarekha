import { Injectable } from '@nestjs/common';
import { spanDays, type HistorySearchRequest, type HistorySearchResponse } from '@bhagyarekha/contracts';
import { DataSource } from 'typeorm';
import { ApiError } from '../../common/api-error.js';
import { Clock } from '../../common/clock.js';
import { DrawEntity } from '../../database/entities/index.js';
import { DeploymentModeService } from '../deployment-mode/deployment-mode.service.js';
import { derivePublicationStatus } from '../results/mapping.js';
import { withReadSnapshot } from '../results/snapshot.js';

const MAX_SPAN_DAYS = 366;

function shiftDays(date: string, days: number): string {
  const d = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

interface Row {
  drawId: string;
  drawCode: string;
  lotteryId: string;
  lotteryNameEn: string;
  lotteryNameMl: string;
  displayDate: string;
  phase: DrawEntity['phase'];
  visibility: DrawEntity['visibility'];
  completeness: 'PARTIAL' | 'COMPLETE';
  revisionNo: number;
  categoryCode: string;
  labelEn: string;
  labelMl: string;
  series: string;
  number: string;
}

/**
 * Bounded exact-string search over CURRENT, ACTIVE, published revisions only.
 * The searched number is a query parameter, never logged or stored.
 */
@Injectable()
export class HistoryService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly clock: Clock,
    private readonly deploymentMode: DeploymentModeService,
  ) {}

  async search(req: HistorySearchRequest): Promise<HistorySearchResponse> {
    const to = req.to ?? (req.from ? shiftDays(req.from, MAX_SPAN_DAYS - 1) : this.clock.todayInKolkata());
    const from = req.from ?? shiftDays(to, -(MAX_SPAN_DAYS - 1));
    if (from > to) throw new ApiError(400, 'INVALID_INPUT', 'from must not be after to', [{ path: 'from', code: 'RANGE_INVERTED' }]);
    if (spanDays(from, to) > MAX_SPAN_DAYS) throw new ApiError(400, 'INVALID_INPUT', `Range may not exceed ${MAX_SPAN_DAYS} days`, [{ path: 'to', code: 'RANGE_TOO_LONG' }]);

    return withReadSnapshot(this.dataSource, async (m) => {
      const params: Record<string, unknown> = { from, to, number: req.number };
      const lotteryClause = req.lotteryId ? 'AND d.lottery_id = :lotteryId' : '';
      if (req.lotteryId) params.lotteryId = req.lotteryId;

      const [counts] = await m.query<{ total: string; searchable: string }[]>(
        `SELECT COUNT(*)::text AS total,
                COUNT(*) FILTER (WHERE d.current_revision_id IS NOT NULL AND d.visibility = 'ACTIVE' AND d.phase <> 'CANCELLED')::text AS searchable
         FROM draw d
         WHERE COALESCE(d.actual_date, d.scheduled_date) BETWEEN $1 AND $2 ${req.lotteryId ? 'AND d.lottery_id = $3' : ''}`,
        req.lotteryId ? [from, to, req.lotteryId] : [from, to],
      );
      const unsearchableDrawCount = Number(counts?.total ?? 0) - Number(counts?.searchable ?? 0);

      const matchClause =
        req.searchType === 'FULL'
          ? `rc.match_kind = 'FULL_NUMBER' AND w.number = :number`
          : `((rc.match_kind = 'SUFFIX' AND w.number = :number) OR (rc.match_kind = 'FULL_NUMBER' AND w.number LIKE '%' || :number))`;

      const base = m
        .createQueryBuilder()
        .from(DrawEntity, 'd')
        .innerJoin('result_revision', 'r', 'r.id = d.current_revision_id')
        .innerJoin('lottery', 'l', 'l.id = d.lottery_id')
        .innerJoin('winning_entry', 'w', 'w.revision_id = r.id')
        .innerJoin('rule_category', 'rc', 'rc.rule_version_id = r.rule_version_id AND rc.code = w.category_code')
        .where(`COALESCE(d.actual_date, d.scheduled_date) BETWEEN :from AND :to ${lotteryClause}`)
        .andWhere(`d.visibility = 'ACTIVE' AND d.phase <> 'CANCELLED'`)
        .andWhere(matchClause)
        .setParameters(params);

      const totalRow = await base.clone().select('COUNT(*)', 'n').getRawOne<{ n: string }>();
      const rows = await base
        .clone()
        .select('d.id', 'drawId')
        .addSelect('d.draw_code', 'drawCode')
        .addSelect('d.lottery_id', 'lotteryId')
        .addSelect('l.name_en', 'lotteryNameEn')
        .addSelect('l.name_ml', 'lotteryNameMl')
        .addSelect(`to_char(COALESCE(d.actual_date, d.scheduled_date), 'YYYY-MM-DD')`, 'displayDate')
        .addSelect('d.phase', 'phase')
        .addSelect('d.visibility', 'visibility')
        .addSelect('r.completeness', 'completeness')
        .addSelect('r.revision_no', 'revisionNo')
        .addSelect('w.category_code', 'categoryCode')
        .addSelect('rc.label_en', 'labelEn')
        .addSelect('rc.label_ml', 'labelMl')
        .addSelect('w.series', 'series')
        .addSelect('w.number', 'number')
        .orderBy('COALESCE(d.actual_date, d.scheduled_date)', 'DESC')
        .addOrderBy('d.id', 'DESC')
        .addOrderBy('rc.priority', 'ASC')
        .addOrderBy('w.series', 'ASC')
        .addOrderBy('w.number', 'ASC')
        .offset((req.page - 1) * req.pageSize)
        .limit(req.pageSize)
        .getRawMany<Row>();

      return {
        dataMode: this.deploymentMode.dataMode,
        from,
        to,
        searchType: req.searchType,
        page: req.page,
        pageSize: req.pageSize,
        total: Number(totalRow?.n ?? 0),
        unsearchableDrawCount,
        items: rows.map((r) => ({
          drawId: r.drawId,
          drawCode: r.drawCode,
          lotteryId: r.lotteryId,
          lotteryName: { en: r.lotteryNameEn, ml: r.lotteryNameMl },
          displayDate: r.displayDate,
          publicationStatus: derivePublicationStatus({ phase: r.phase, visibility: r.visibility }, { completeness: r.completeness }),
          revisionNo: Number(r.revisionNo),
          categoryCode: r.categoryCode,
          categoryLabel: { en: r.labelEn, ml: r.labelMl },
          series: r.series,
          number: r.number,
        })),
      };
    });
  }
}
