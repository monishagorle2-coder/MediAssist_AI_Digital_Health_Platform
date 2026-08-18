import { Request, Response, NextFunction } from "express";

interface RateLimiterOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  message?: string;
}

interface RequestRecord {
  count: number;
  resetTime: number;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const ipStore = new Map<string, RequestRecord>();
  const { windowMs, maxRequests, message = "Too many requests. Please try again later." } = options;

  // Periodically clean up expired entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of ipStore.entries()) {
      if (now > record.resetTime) {
        ipStore.delete(ip);
      }
    }
  }, 5 * 60 * 1000);

  return (req: Request, res: Response, next: NextFunction) => {
    const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || req.socket.remoteAddress || "unknown_ip";
    const now = Date.now();

    const currentRecord = ipStore.get(clientIp);

    if (!currentRecord || now > currentRecord.resetTime) {
      ipStore.set(clientIp, {
        count: 1,
        resetTime: now + windowMs,
      });
      res.setHeader("X-RateLimit-Limit", maxRequests);
      res.setHeader("X-RateLimit-Remaining", maxRequests - 1);
      return next();
    }

    if (currentRecord.count >= maxRequests) {
      const retryAfterSeconds = Math.ceil((currentRecord.resetTime - now) / 1000);
      res.setHeader("Retry-After", retryAfterSeconds);
      res.setHeader("X-RateLimit-Limit", maxRequests);
      res.setHeader("X-RateLimit-Remaining", 0);
      return res.status(429).json({
        error: message,
        retryAfter: retryAfterSeconds,
      });
    }

    currentRecord.count += 1;
    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", maxRequests - currentRecord.count);
    next();
  };
}
