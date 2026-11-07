import { createHash, timingSafeEqual } from "node:crypto";
import type express from "express";
import { jwtVerify, SignJWT } from "jose";
import type { Clock } from "./clock.ts";
import type { Config } from "./config.ts";

const sessionMilliseconds = 12 * 60 * 60 * 1000;

export interface Session {
  token: string;
  expiresAt: string;
}

export interface Auth {
  signIn(login: unknown, password: unknown): Promise<Session | null>;
  requireDispatcher: express.RequestHandler;
}

function sameText(actual: unknown, expected: string): boolean {
  const digest = (text: string) => createHash("sha256").update(text).digest();
  return typeof actual === "string" && timingSafeEqual(digest(actual), digest(expected));
}

export function createAuth({ config, clock }: { config: Config; clock: Clock }): Auth {
  const secret = new TextEncoder().encode(config.jwtSecret);

  return {
    async signIn(login, password) {
      const loginMatches = sameText(login, config.dispatcherLogin);
      const passwordMatches = sameText(password, config.dispatcherPassword);
      if (!loginMatches || !passwordMatches) {
        return null;
      }
      const now = clock.now();
      const expiresAt = new Date(now.getTime() + sessionMilliseconds);
      const token = await new SignJWT({})
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(config.dispatcherLogin)
        .setIssuedAt(now)
        .setExpirationTime(expiresAt)
        .sign(secret);
      return { token, expiresAt: expiresAt.toISOString() };
    },

    async requireDispatcher(req, res, next) {
      const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
      try {
        await jwtVerify(token ?? "", secret, { algorithms: ["HS256"], currentDate: clock.now() });
      } catch {
        res.status(401).json({ error: "unauthorized" });
        return;
      }
      next();
    },
  };
}
