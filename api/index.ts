import express from "express";
import dotenv from "dotenv";
import redis from "../src/config/redis";
import authRoutes from "../src/routes/authRoutes";

dotenv.config();

const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.json());

// Root route
app.get("/", (req, res) => res.send("Stream Chat API is running..."));

// Routes
app.use("/", authRoutes);

const startServer = async () => {
    try {
        await redis.connect();
        console.log("Connected to Redis");
        
        app.listen(PORT, () => {
            console.log(`Listening on port ${PORT}`);
        });
    } catch (err) {
        console.error("Failed to connect to Redis:", err);
    }
};

startServer();

export default app;