import { describe, expect, it } from 'vitest';
import { DrawListQuerySchema } from '@bhagyarekha/contracts';
import { ApiError } from '../../src/common/api-error.js';
import { ZodValidationPipe } from '../../src/common/zod-validation.pipe.js';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(DrawListQuerySchema);

  it('returns parsed data with defaults', () => {
    expect(pipe.transform(undefined)).toEqual({ page: 1, pageSize: 20 });
    expect(pipe.transform({ page: '2' })).toMatchObject({ page: 2 });
  });

  it('throws 400 INVALID_INPUT with field paths and codes but no values', () => {
    let error: unknown;
    try {
      pipe.transform({ pageSize: '9999', lotteryId: 'secret-value-should-not-echo' });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.getStatus()).toBe(400);
    expect(apiError.code).toBe('INVALID_INPUT');
    expect(apiError.fields?.map((f) => f.path).sort()).toEqual(['lotteryId', 'pageSize']);
    expect(JSON.stringify(apiError.fields)).not.toContain('secret-value');
  });
});
