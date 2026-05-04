"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const redis_1 = __importDefault(require("../src/config/redis"));
const authRoutes_1 = __importDefault(require("../src/routes/authRoutes"));
dotenv_1.default.config();
const PORT = process.env.PORT || 3000;
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Root route
app.get("/", (req, res) => res.send("Stream Chat API is running..."));
// Routes
app.use("/", authRoutes_1.default);
const startServer = async () => {
    try {
        await redis_1.default.connect();
        console.log("Connected to Redis");
        app.listen(PORT, () => {
            console.log(`Listening on port ${PORT}`);
        });
    }
    catch (err) {
        console.error("Failed to connect to Redis:", err);
    }
};
startServer();
exports.default = app;
//# sourceMappingURL=index.js.map