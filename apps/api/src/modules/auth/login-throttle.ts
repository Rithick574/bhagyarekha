/**
 * In-process failed-login limiter (LLD §7.2: 5 failures per account per 15 minutes plus an IP limit).
 * Adequate for the single-instance release; replace with a shared store before horizontal scaling.
 * Failures never lock an account permanently.
 */
export class LoginThrottle {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly windowMs = 15 * 60_000,
    private readonly perAccount = 5,
    private readonly perIp = 30,
  ) {}

  /** Returns seconds to wait when blocked, otherwise 0. */
  blockedFor(email: string, ip: string, now = Date.now()): number {
    return Math.max(this.remaining(`e:${email}`, this.perAccount, now), this.remaining(`ip:${ip}`, this.perIp, now));
  }

  recordFailure(email: string, ip: string, now = Date.now()): void {
    this.bump(`e:${email}`, now);
    this.bump(`ip:${ip}`, now);
  }

  recordSuccess(email: string): void {
    this.buckets.delete(`e:${email}`);
  }

  private remaining(key: string, limit: number, now: number): number {
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) return 0;
    return bucket.count >= limit ? Math.ceil((bucket.resetAt - now) / 1000) : 0;
  }

  private bump(key: string, now: number): void {
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
    else bucket.count += 1;
  }
}
