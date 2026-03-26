// Simple in-memory TTL cache for Next.js API routes.
// Prevents hammering the GitHub Search API (30 req/min limit).

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

export function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const entry = store.get(key);
  if (entry && Date.now() < entry.expiresAt) {
    return Promise.resolve(entry.value as T);
  }
  return fn().then((value) => {
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  });
}

/** Called by POST /api/cache/clear on manual Sync — busts pr-details entries only. */
export function clearPrDetailsCache(): void {
  for (const key of store.keys()) {
    if (key.startsWith("pr-details:")) store.delete(key);
  }
}
