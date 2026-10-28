import type { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "crypto";

// 外部專案介接用的 /api 中介層（說明見 docs/api.md）：
// - CORS_ALLOWED_ORIGINS：允許從瀏覽器跨網域呼叫的來源，逗號分隔，例如
//   "https://other-app.onrender.com,http://localhost:3000"。沒設就不開放跨網域。
// - INTEGRATION_API_KEY：設了之後，外部的寫入請求（POST/PATCH/PUT/DELETE）
//   要帶 X-API-Key。本站自己的畫面是同網域請求，不受影響。沒設就維持舊行為。

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function parseOrigins(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((s) => s.trim().replace(/\/+$/, ""))
      .filter(Boolean),
  );
}

function isSameOrigin(req: Request): boolean {
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function keyMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function integrationMiddleware() {
  const allowedOrigins = parseOrigins(process.env.CORS_ALLOWED_ORIGINS);
  const apiKey = process.env.INTEGRATION_API_KEY?.trim() || "";

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith("/api")) return next();

    const origin = req.headers.origin;
    if (origin && allowedOrigins.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Key");
      res.setHeader("Access-Control-Max-Age", "600");
      if (req.method === "OPTIONS") return res.status(204).end();
    }

    if (apiKey && !READ_METHODS.has(req.method) && !isSameOrigin(req)) {
      const given = req.get("X-API-Key") ?? "";
      if (!keyMatches(given, apiKey)) {
        return res.status(401).json({ error: "Missing or invalid X-API-Key" });
      }
    }

    next();
  };
}
