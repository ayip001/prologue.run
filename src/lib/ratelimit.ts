import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Initialize Redis client (uses UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars)
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Rate limiter for view counting: 1 request per IP per race per hour
// Uses sliding window algorithm for smooth rate limiting
export const viewRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(1, "1 h"),
  analytics: true,
  prefix: "ratelimit:view",
});

/**
 * Check if a view should be counted based on rate limiting.
 * Returns true if the view should be counted, false if rate limited.
 *
 * @param ip - The client IP address
 * @param raceSlug - The race slug being viewed
 */
export async function shouldCountView(
  ip: string,
  raceSlug: string
): Promise<{ allowed: boolean; remaining: number }> {
  // Create a unique identifier combining IP and race
  const identifier = `${ip}:${raceSlug}`;

  const { success, remaining } = await viewRateLimiter.limit(identifier);

  return { allowed: success, remaining };
}
