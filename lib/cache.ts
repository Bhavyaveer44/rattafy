// Intelligent caching layer to reduce API calls
// Uses in-memory cache for development, can be upgraded to Redis for production

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// Simple in-memory cache (for development/scale-up)
const memoryCache = new Map<string, CacheEntry<unknown>>();

// Cache TTL configurations (in milliseconds)
const TTL = {
  PLAN: 24 * 60 * 60 * 1000, // 24 hours - plans don't change often
  PREDICTION: 12 * 60 * 60 * 1000, // 12 hours - predictions are stable
  OCR: 7 * 24 * 60 * 60 * 1000, // 7 days - PDF content doesn't change
  ANSWER: 24 * 60 * 60 * 1000, // 24 hours - answers are stable
} as const;

// Generate cache key from input parameters
export function generateCacheKey(prefix: string, params: Record<string, unknown>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}:${String(params[key])}`)
    .join("|");
  return `${prefix}:${sortedParams}`;
}

// Simple hash function for content-based caching
export function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

// Get cached value
export function getCache<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.timestamp > entry.ttl) {
    memoryCache.delete(key);
    return null;
  }

  return entry.data as T;
}

// Get cached value even if expired (for fallback)
export function getStaleCache<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;

  // Return stale data if it's not too old (max 7 days)
  const maxStaleAge = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  if (now - entry.timestamp > maxStaleAge) {
    memoryCache.delete(key);
    return null;
  }

  return entry.data as T;
}

// Set cached value
export function setCache<T>(key: string, data: T, ttl: number): void {
  memoryCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl,
  });
}

// Clear cache by prefix
export function clearCachePrefix(prefix: string): void {
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
    }
  }
}

// Clear all cache
export function clearAllCache(): void {
  memoryCache.clear();
}

// Get cache stats
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: memoryCache.size,
    keys: Array.from(memoryCache.keys()),
  };
}

// Cache helpers for specific use cases
export const cacheHelpers = {
  plan: {
    get: (syllabus: string, hours: number, goal: string, pyq: string) => {
      const key = generateCacheKey("plan", { syllabus, hours, goal, pyq });
      return getCache(key);
    },
    getStale: (syllabus: string, hours: number, goal: string, pyq: string) => {
      const key = generateCacheKey("plan", { syllabus, hours, goal, pyq });
      return getStaleCache(key);
    },
    set: (syllabus: string, hours: number, goal: string, pyq: string, data: unknown) => {
      const key = generateCacheKey("plan", { syllabus, hours, goal, pyq });
      setCache(key, data, TTL.PLAN);
    },
  },
  prediction: {
    get: (syllabus: string, pyq: string) => {
      const key = generateCacheKey("prediction", { syllabus, pyq });
      return getCache(key);
    },
    getStale: (syllabus: string, pyq: string) => {
      const key = generateCacheKey("prediction", { syllabus, pyq });
      return getStaleCache(key);
    },
    set: (syllabus: string, pyq: string, data: unknown) => {
      const key = generateCacheKey("prediction", { syllabus, pyq });
      setCache(key, data, TTL.PREDICTION);
    },
  },
  ocr: {
    get: (contentHash: string) => {
      const key = generateCacheKey("ocr", { hash: contentHash });
      return getCache(key);
    },
    getStale: (contentHash: string) => {
      const key = generateCacheKey("ocr", { hash: contentHash });
      return getStaleCache(key);
    },
    set: (contentHash: string, data: unknown) => {
      const key = generateCacheKey("ocr", { hash: contentHash });
      setCache(key, data, TTL.OCR);
    },
  },
  answer: {
    get: (question: string, marks: number, subject: string) => {
      const key = generateCacheKey("answer", { question, marks, subject });
      return getCache(key);
    },
    getStale: (question: string, marks: number, subject: string) => {
      const key = generateCacheKey("answer", { question, marks, subject });
      return getStaleCache(key);
    },
    set: (question: string, marks: number, subject: string, data: unknown) => {
      const key = generateCacheKey("answer", { question, marks, subject });
      setCache(key, data, TTL.ANSWER);
    },
  },
};
