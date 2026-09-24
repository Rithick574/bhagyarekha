import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  DrawIdParamsSchema,
  DrawListQuerySchema,
  LatestQuerySchema,
  LotteryListQuerySchema,
  ResultQuerySchema,
  type DrawDetail,
  type DrawIdParams,
  type DrawListQuery,
  type DrawListResponse,
  type LatestQuery,
  type LatestResponse,
  type LotteryListQuery,
  type LotteryListResponse,
  type ResultQuery,
  type ResultResponse,
} from '@bhagyarekha/contracts';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { ResultReadService } from './result-read.service.js';

/** Thin controllers: validate with shared contracts, delegate to the read service. */
@Controller()
export class ResultsController {
  constructor(private readonly reads: ResultReadService) {}

  @Get('lotteries')
  listLotteries(@Query(new ZodValidationPipe(LotteryListQuerySchema)) query: LotteryListQuery): Promise<LotteryListResponse> {
    return this.reads.listLotteries(query.active === undefined ? undefined : query.active === 'true');
  }

  @Get('draws')
  listDraws(@Query(new ZodValidationPipe(DrawListQuerySchema)) query: DrawListQuery): Promise<DrawListResponse> {
    return this.reads.listDraws(query);
  }

  // Declared before ':drawId' so "latest" is never parsed as an identifier.
  @Get('draws/latest')
  latest(@Query(new ZodValidationPipe(LatestQuerySchema)) query: LatestQuery): Promise<LatestResponse> {
    return this.reads.latest(query.lotteryId);
  }

  @Get('draws/:drawId')
  getDraw(@Param(new ZodValidationPipe(DrawIdParamsSchema)) params: DrawIdParams): Promise<DrawDetail> {
    return this.reads.getDraw(params.drawId);
  }

  @Get('draws/:drawId/result')
  getResult(
    @Param(new ZodValidationPipe(DrawIdParamsSchema)) params: DrawIdParams,
    @Query(new ZodValidationPipe(ResultQuerySchema)) query: ResultQuery,
  ): Promise<ResultResponse> {
    return this.reads.getResult(params.drawId, query);
  }
}
