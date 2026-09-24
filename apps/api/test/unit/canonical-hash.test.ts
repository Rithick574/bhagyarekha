import { describe, expect, it } from 'vitest';
import { canonicalHash, canonicalJson } from '../../src/common/canonical-hash.js';

describe('canonical hashing', () => {
  it('is independent of object key order but sensitive to array order and values', () => {
    expect(canonicalJson({ b: 1, a: { d: '2', c: [3, { f: 1, e: 2 }] } })).toBe('{"a":{"c":[3,{"e":2,"f":1}],"d":"2"},"b":1}');
    expect(canonicalHash({ a: 1, b: 2 })).toBe(canonicalHash({ b: 2, a: 1 }));
    expect(canonicalHash([1, 2])).not.toBe(canonicalHash([2, 1]));
    expect(canonicalHash({ number: '001234' })).not.toBe(canonicalHash({ number: '1234' }));
  });
});
