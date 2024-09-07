import express from "express";
import dotenv from "dotenv";
import { genSaltSync, hashSync } from "bcrypt";
// import { StreamChat } from "stream-chat";

dotenv.config();

const { PORT, STREAM_API_KEY, STREAM_API_SECRET } = process.env;
// const serverClient = StreamChat.getInstance(STREAM_API_KEY!, STREAM_API_SECRET);
const app = express();
app.use(express.json());
const salt = genSaltSync(10);

interface User {
    id: string;
    email: string;
    hashed_password: string;
}

const USERS: User[] = [];

app.get("/", (req, res) => res.send("Express on Vercel"));

app.post("/register", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Missing username or email" });
    }

    if (USERS.find(user => user.email === email)) {
        return res.status(400).json({ error: "User already exists" });
    }

    if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters long" });
    }
    try {
        const hashed_password = hashSync(password, salt);
        const id = Math.random().toString(36).slice(2);
        console.log(id);
        const newUser = {
            id, email, hashed_password
        }
        USERS.push(newUser);

        // await serverClient.upsertUsers([{
        //     id,
        //     email,
        //     name: email,
        // }]);

        // const token = serverClient.createToken(id);
        return res.status(200).json({
            // token, 
            user: { id, email }
        });

    } catch (err) {
        res.status(500).send({ error: "User already exists" });
    }
});

app.post("/login", (req, res) => {
    const { email, password } = req.body;
    const user = USERS.find(user => user.email === email);
    const hashed_password = hashSync(password, salt);
    if (!user || user.hashed_password !== hashed_password) {
        return res.status(400).json({ error: "Invalid username or password" });
    }
    // const token = serverClient.createToken(user.id);
    return res.status(200).json({
        // token,
        user: { id: user.id, email: user.email }
    });
});

app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
})

module.exports = app;