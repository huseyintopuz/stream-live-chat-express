import { Request, Response } from "express";
import { compare, hash } from "bcryptjs";
import { collection, doc, getDoc, setDoc, runTransaction } from "firebase/firestore";
import { db } from "../../firebase";
import serverClient from "../config/stream";
import redis from "../config/redis";
import crypto from "crypto";
import { SESSION_PREFIX } from "../constants";

const usersCollectionRef = collection(db, "users");

async function getUserForLogin(email: string) {
    const userDocRef = doc(db, "users", email?.toLowerCase());
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) return null;

    return userDoc.data();
}

/**
 * REGISTER
 */
export const register = async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const normalizedEmail = (email || "").trim().toLowerCase();

    if (!normalizedEmail || !password) {
        return res.status(400).json({ message: "Email and password required" });
    }

    if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters long" });
    }

    try {
        const hashedPassword = await hash(password, 10);
        const id = crypto.randomUUID();

        const newUser = {
            id,
            email: normalizedEmail,
            hashed_password: hashedPassword
        };

        // Direkt email ID'si ile döküman oluştur
        const docRef = doc(db, "users", normalizedEmail);

        await runTransaction(db, async (tx) => {
            const snap = await tx.get(docRef);

            if (snap.exists()) {
                throw new Error("USER_EXISTS");
            }

            tx.set(docRef, newUser);
        });

        // cache sadece public data
        await redis.hSet(
            `user:public:${normalizedEmail}`,
            { id, email: normalizedEmail }
        );
        await redis.expire(`user:public:${normalizedEmail}`, 60 * 60);

        await serverClient.upsertUsers([
            { id, email: normalizedEmail, name: email }
        ]);

        const token = serverClient.createToken(id);

        // session/token store (Multi-device support)
        const hashedToken = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        await redis.set(
            `${SESSION_PREFIX}${hashedToken}`,
            id,
            { EX: 604800 }
        );

        return res.status(201).json({
            token,
            user: { id, email: normalizedEmail }
        });

    } catch (err: any) {
        if (err.message === "USER_EXISTS") {
            return res.status(400).json({ error: "User already exists" });
        }

        return res.status(500).json({ error: "Registration failed" });
    }
};

/**
 * LOGIN
 */
export const login = async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const normalizedEmail = email.trim().toLowerCase();

    if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
    }
    const ip =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
        req.ip;

    const rateEmailKey = `login:attempts:${normalizedEmail}`;
    const rateIpKey = `login:attempts:${ip}`;

    const emailAttempts = await redis.incr(rateEmailKey);
    const ipAttempts = await redis.incr(rateIpKey);

    if (emailAttempts === 1) {
        await redis.expire(rateEmailKey, 60);
    }

    if (ipAttempts === 1) {
        await redis.expire(rateIpKey, 60);
    }

    if (emailAttempts > 5 || ipAttempts > 10) {
        return res.status(429).json({
            error: "Too many attempts. Try again in 1 minute"
        });
    }

    const user = await getUserForLogin(normalizedEmail);

    const fakeHash = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8k1bZrj5l5Q0h5Q5h5Q5h5Q5h5Q5h5";

    const hashToCompare = user?.hashed_password || fakeHash;

    const isMatch = await compare(password, hashToCompare);

    if (!user || !isMatch) {
        return res.status(400).json({ error: "Invalid credentials" });
    }

    await Promise.all([
        redis.del(rateEmailKey),
        redis.del(rateIpKey)
    ]);

    const token = serverClient.createToken(user.id);

    // session store (Multi-device support)
    const hashedToken = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

    await redis.set(
        `${SESSION_PREFIX}${hashedToken}`,
        JSON.stringify({
            userId: user.id,
            ip,
            userAgent: req.headers["user-agent"],
            createdAt: Date.now()
        }),
        { EX: 604800 }
    );

    return res.status(200).json({
        token,
        user: { id: user.id, email: normalizedEmail }
    });
};

/**
 * LOGOUT
 */
export const logout = async (req: Request, res: Response) => {
    const sessionKey = req.user?.sessionKey;

    if (!sessionKey) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    await redis.del(sessionKey);

    return res.status(200).json({
        message: "Logged out successfully"
    });
};

/**
 * PROFILE
 */
export const getProfile = async (req: Request, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
        return res.status(400).json({ error: "Missing user id" });
    }

    return res.json({
        user: {
            id: userId
        }
    });
};
