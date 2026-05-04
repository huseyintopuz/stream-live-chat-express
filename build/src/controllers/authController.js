"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfile = exports.logout = exports.resetPassword = exports.forgotPassword = exports.login = exports.register = void 0;
const bcryptjs_1 = require("bcryptjs");
const firebase_1 = require("../../firebase");
const stream_1 = __importDefault(require("../config/stream"));
const redis_1 = __importDefault(require("../config/redis"));
const crypto_1 = __importDefault(require("crypto"));
const constants_1 = require("../constants");
const sendResetEmail_1 = require("../services/mail/sendResetEmail");
// const usersCollectionRef = collection(db, "users");
async function getUserForLogin(email) {
    const userDocRef = firebase_1.db.collection("users").doc(email === null || email === void 0 ? void 0 : email.toLowerCase());
    const userDoc = await userDocRef.get();
    if (!userDoc.exists)
        return null;
    return userDoc.data();
}
/**
 * REGISTER
 */
const register = async (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = (email || "").trim().toLowerCase();
    if (!normalizedEmail || !password) {
        return res.status(400).json({ message: "Email and password required" });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters long" });
    }
    try {
        const hashedPassword = await (0, bcryptjs_1.hash)(password, 10);
        const id = crypto_1.default.randomUUID();
        const newUser = {
            id,
            email: normalizedEmail,
            hashed_password: hashedPassword
        };
        // Direkt email ID'si ile döküman oluştur
        const docRef = firebase_1.db.collection("users").doc(normalizedEmail);
        await firebase_1.db.runTransaction(async (tx) => {
            const snap = await tx.get(docRef);
            if (snap.exists) {
                throw new Error("USER_EXISTS");
            }
            tx.set(docRef, newUser);
        });
        // cache sadece public data
        await redis_1.default.hSet(`user:public:${normalizedEmail}`, { id, email: normalizedEmail });
        await redis_1.default.expire(`user:public:${normalizedEmail}`, 60 * 60);
        await stream_1.default.upsertUsers([
            { id, email: normalizedEmail, name: email }
        ]);
        const token = stream_1.default.createToken(id);
        // session/token store (Multi-device support)
        const hashedToken = crypto_1.default
            .createHash("sha256")
            .update(token)
            .digest("hex");
        await redis_1.default.set(`${constants_1.SESSION_PREFIX}${hashedToken}`, id, { EX: 604800 });
        return res.status(201).json({
            token,
            user: { id, email: normalizedEmail }
        });
    }
    catch (err) {
        if (err.message === "USER_EXISTS") {
            return res.status(400).json({ error: "User already exists" });
        }
        return res.status(500).json({ error: "Registration failed" });
    }
};
exports.register = register;
/**
 * LOGIN
 */
const login = async (req, res) => {
    var _a;
    const { email, password } = req.body;
    const normalizedEmail = email.trim().toLowerCase();
    if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
    }
    const ip = ((_a = req.headers["x-forwarded-for"]) === null || _a === void 0 ? void 0 : _a.split(",")[0]) ||
        req.ip;
    const rateEmailKey = `login:attempts:${normalizedEmail}`;
    const rateIpKey = `login:attempts:${ip}`;
    const emailAttempts = await redis_1.default.incr(rateEmailKey);
    const ipAttempts = await redis_1.default.incr(rateIpKey);
    if (emailAttempts === 1) {
        await redis_1.default.expire(rateEmailKey, 60);
    }
    if (ipAttempts === 1) {
        await redis_1.default.expire(rateIpKey, 60);
    }
    if (emailAttempts > 5 || ipAttempts > 10) {
        return res.status(429).json({
            error: "Too many attempts. Try again in 1 minute"
        });
    }
    const user = await getUserForLogin(normalizedEmail);
    const fakeHash = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8k1bZrj5l5Q0h5Q5h5Q5h5Q5h5Q5h5";
    const hashToCompare = (user === null || user === void 0 ? void 0 : user.hashed_password) || fakeHash;
    const isMatch = await (0, bcryptjs_1.compare)(password, hashToCompare);
    if (!user || !isMatch) {
        return res.status(400).json({ error: "Invalid credentials" });
    }
    await Promise.all([
        redis_1.default.del(rateEmailKey),
        redis_1.default.del(rateIpKey)
    ]);
    const token = stream_1.default.createToken(user.id);
    // session store (Multi-device support)
    const hashedToken = crypto_1.default
        .createHash("sha256")
        .update(token)
        .digest("hex");
    await redis_1.default.set(`${constants_1.SESSION_PREFIX}${hashedToken}`, JSON.stringify({
        userId: user.id,
        ip,
        userAgent: req.headers["user-agent"],
        createdAt: Date.now()
    }), { EX: 604800 });
    return res.status(200).json({
        token,
        user: { id: user.id, email: normalizedEmail }
    });
};
exports.login = login;
const forgotPassword = async (req, res) => {
    const { email } = req.body;
    const normalizedEmail = email.trim().toLowerCase();
    const user = await getUserForLogin(normalizedEmail);
    if (!user) {
        return res.status(200).json({
            message: "If the account exists, reset link has been sent"
        });
    }
    const resetToken = crypto_1.default.randomBytes(32).toString("hex");
    const hashedToken = crypto_1.default
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");
    const resetLink = `streamlivechat://reset-password?token=${resetToken}`;
    await redis_1.default.set(`reset:${hashedToken}`, user.id, { EX: 900 });
    await (0, sendResetEmail_1.sendResetEmail)(user.email, resetLink);
    return res.status(200).json({
        message: "If the account exists, reset link has been sent"
    });
};
exports.forgotPassword = forgotPassword;
const resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
        return res.status(400).json({ error: "Token and new password required" });
    }
    if (newPassword.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    try {
        // 1. token hashle
        const hashedToken = crypto_1.default
            .createHash("sha256")
            .update(token)
            .digest("hex");
        const key = `reset:${hashedToken}`;
        // 2. redis'ten userId al
        const userId = await redis_1.default.get(key);
        if (!userId) {
            return res.status(400).json({ error: "Invalid or expired reset token" });
        }
        // 3. password hashle
        const hashedPassword = await (0, bcryptjs_1.hash)(newPassword, 10);
        // 4. Firestore update
        const userRef = firebase_1.db.collection("users").doc(userId);
        await userRef.update({
            hashed_password: hashedPassword
        });
        // 5. token'ı sil (tek kullanımlık)
        await redis_1.default.del(key);
        return res.status(200).json({
            message: "Password updated successfully"
        });
    }
    catch (err) {
        return res.status(500).json({
            error: "Failed to reset password"
        });
    }
};
exports.resetPassword = resetPassword;
/**
 * LOGOUT
 */
const logout = async (req, res) => {
    var _a;
    const sessionKey = (_a = req.user) === null || _a === void 0 ? void 0 : _a.sessionKey;
    if (!sessionKey) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    await redis_1.default.del(sessionKey);
    return res.status(200).json({
        message: "Logged out successfully"
    });
};
exports.logout = logout;
/**
 * PROFILE
 */
const getProfile = async (req, res) => {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    if (!userId) {
        return res.status(400).json({ error: "Missing user id" });
    }
    return res.json({
        user: {
            id: userId
        }
    });
};
exports.getProfile = getProfile;
//# sourceMappingURL=authController.js.map