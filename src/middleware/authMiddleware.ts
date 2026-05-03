import { Request, Response, NextFunction } from "express";
import redis from "../config/redis";
import crypto from "crypto";
import { SESSION_PREFIX } from "../constants";

declare global {
    namespace Express {
        interface Request {
            user?: { id: string, sessionKey: string };
        }
    }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers["authorization"];

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const hashedToken = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        const sessionKey = `${SESSION_PREFIX}${hashedToken}`;

        const userId = await redis.get(sessionKey);

        if (!userId) {
            return res.status(401).json({ error: "Invalid or expired session" });
        }

        if (Math.random() < 0.1) {
            await redis.expire(sessionKey, 604800);
        }

        req.user = {
            id: userId,
            sessionKey
        };
        next();
    } catch (err) {
        return res.status(500).json({ error: "Internal server error during authentication" });
    }
}
