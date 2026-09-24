import { Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';
import { ApiError, type FieldError } from './api-error.js';

/**
 * Validates body/query/params with a Zod schema from packages/contracts.
 * Failures become 400 INVALID_INPUT with field paths and issue codes only —
 * the submitted values are never echoed back.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value ?? {});
    if (result.success) return result.data;
    const fields: FieldError[] = result.error.issues.map((issue) => ({
      path: issue.path.map(String).join('.') || '(root)',
      code: issue.code.toUpperCase(),
    }));
    throw new ApiError(400, 'INVALID_INPUT', 'Request validation failed', fields);
  }
}
