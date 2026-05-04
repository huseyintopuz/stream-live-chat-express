"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const redis_1 = __importDefault(require("../config/redis"));
const crypto_1 = __importDefault(require("crypto"));
const constants_1 = require("../constants");
async function authMiddleware(req, res, next) {
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const token = authHeader.split(" ")[1];
    try {
        const hashedToken = crypto_1.default
            .createHash("sha256")
            .update(token)
            .digest("hex");
        const sessionKey = `${constants_1.SESSION_PREFIX}${hashedToken}`;
        const userId = await redis_1.default.get(sessionKey);
        if (!userId) {
            return res.status(401).json({ error: "Invalid or expired session" });
        }
        if (Math.random() < 0.1) {
            await redis_1.default.expire(sessionKey, 604800);
        }
        req.user = {
            id: userId,
            sessionKey
        };
        next();
    }
    catch (err) {
        return res.status(500).json({ error: "Internal server error during authentication" });
    }
}
//# sourceMappingURL=authMiddleware.js.map