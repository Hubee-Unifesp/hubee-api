export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export type RateLimitStore = Map<string, RateLimitEntry>;

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function consumeRateLimit(
  store: RateLimitStore,
  key: string,
  { limit, windowMs }: RateLimitOptions,
  now: number = Date.now(),
): RateLimitResult {
  pruneExpiredEntries(store, now);

  const current = store.get(key);
  const isNewWindow = !current || now >= current.resetAt;
  const entry = isNewWindow
    ? { count: 1, resetAt: now + windowMs }
    : { count: current.count + 1, resetAt: current.resetAt };

  store.set(key, entry);

  if (isNewWindow) {
    scheduleEntryCleanup(store, key, entry.resetAt, windowMs);
  }

  return {
    allowed: entry.count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
}

function pruneExpiredEntries(store: RateLimitStore, now: number): void {
  for (const [key, entry] of store.entries()) {
    if (now >= entry.resetAt) {
      store.delete(key);
    }
  }
}

function scheduleEntryCleanup(
  store: RateLimitStore,
  key: string,
  resetAt: number,
  windowMs: number,
): void {
  const timer = setTimeout(() => {
    if (store.get(key)?.resetAt === resetAt) {
      store.delete(key);
    }
  }, windowMs);
  timer.unref?.();
}
