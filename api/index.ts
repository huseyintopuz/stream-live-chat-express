import express from "express";
import dotenv from "dotenv";
import { compareSync, genSaltSync, hashSync } from "bcryptjs";
import { StreamChat } from "stream-chat";
import { db } from "../firebase";
import { addDoc, collection, getDocs, query, where } from "firebase/firestore";

dotenv.config();

const { PORT, STREAM_API_KEY, STREAM_API_SECRET } = process.env;
const serverClient = StreamChat.getInstance(STREAM_API_KEY!, STREAM_API_SECRET);

const app = express();
app.use(express.json());

const salt = genSaltSync(10);

const usersCollectionRef = collection(db, "users");
// Async function to fetch data from Firestore
async function getUserByEmail(email: string) {
    const q = query(usersCollectionRef, where("email", "==", email));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0].data().newUser;
        return {
            id: userDoc.id,
            email: userDoc.email,
            hashed_password: userDoc.hashed_password,
        };
    }
    return null;
}

app.get("/", (req, res) => res.send("Express on Vercel"));

app.post("/register", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Missing username or email" });
    }

    const existingUser = await getUserByEmail(email);

    if (existingUser) {
        return res.status(400).json({ error: "User already exists" });
    }

    if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters long" });
    }

    const hashed_password = hashSync(password, salt);
    const id = Math.random().toString(36).slice(2);
    const newUser = {
        id, email, hashed_password
    }

    await addDoc(usersCollectionRef, {
        newUser
    });

    await serverClient.upsertUsers([{
        id,
        email,
        name: email,
    }]);

    const token = serverClient.createToken(id);
    return res.status(200).json({
        token,
        user: { id, email }
    });
});

app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const user = await getUserByEmail(email);
    console.log(user);

    if (!user) {
        return res.status(400).json({ error: "Invalid email" });
    }
    if (user && !compareSync(password, user.hashed_password)) {
        return res.status(400).json({ error: "Invalid password" });
    }

    const token = serverClient.createToken(user.id);

    return res.status(200).json({
        token,
        user: { id: user.id, email: user.email }
    });
});

app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
})

module.exports = app;