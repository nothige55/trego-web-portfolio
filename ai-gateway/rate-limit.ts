type RateLimiterOptions = {
  readonly limit: number;
  readonly windowMs: number;
};

export type RateLimiter = {
  readonly consume: (key: string, now: number) => boolean;
};

// Gateway는 사용자에게 직접 노출되므로 OpenAI 키가 토큰 소각 표적이 된다.
// 멤버 단위 고정 윈도우 카운터로 한도를 건다.
export function createRateLimiter({ limit, windowMs }: RateLimiterOptions): RateLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>();

  return {
    consume(key, now) {
      for (const [existingKey, window] of windows) {
        if (window.resetAt <= now) windows.delete(existingKey);
      }

      const current = windows.get(key);
      if (!current || current.resetAt <= now) {
        windows.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }

      if (current.count >= limit) return false;

      current.count += 1;
      return true;
    },
  };
}
