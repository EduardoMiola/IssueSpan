type AttemptBucket = {
  count: number;
  expiresAt: number;
};

const WINDOW_MS = 15 * 60_000;
const MAX_BUCKETS = 10_000;
const MAX_ATTEMPTS_PER_ACCOUNT = 5;
const MAX_ATTEMPTS_PER_IP = 20;

/** Process-local login abuse boundary with bounded memory and expiring counters. */
export class LoginRateLimiter {
  private readonly buckets = new Map<string, AttemptBucket>();

  constructor(private readonly now: () => Date) {}

  isAllowed(ipAddress: string, email: string): boolean {
    const timestamp = this.now().getTime();
    this.removeExpiredBuckets(timestamp);
    const ipIsAllowed = this.consume(`ip:${ipAddress}`, MAX_ATTEMPTS_PER_IP, timestamp);
    const accountIsAllowed = this.consume(`account:${email}`, MAX_ATTEMPTS_PER_ACCOUNT, timestamp);
    this.evictOldestBuckets();
    return ipIsAllowed && accountIsAllowed;
  }

  private consume(key: string, limit: number, timestamp: number): boolean {
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.expiresAt <= timestamp) {
      this.buckets.delete(key);
      this.buckets.set(key, { count: 1, expiresAt: timestamp + WINDOW_MS });
      return true;
    }

    if (bucket.count >= limit) return false;

    this.buckets.delete(key);
    this.buckets.set(key, { ...bucket, count: bucket.count + 1 });
    return true;
  }

  private removeExpiredBuckets(timestamp: number): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.expiresAt <= timestamp) this.buckets.delete(key);
    }
  }

  private evictOldestBuckets(): void {
    while (this.buckets.size >= MAX_BUCKETS) {
      const oldestKey = this.buckets.keys().next().value;
      if (!oldestKey) return;
      this.buckets.delete(oldestKey);
    }
  }
}
