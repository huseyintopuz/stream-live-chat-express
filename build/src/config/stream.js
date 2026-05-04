"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const stream_chat_1 = require("stream-chat");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const { STREAM_API_KEY, STREAM_API_SECRET } = process.env;
const serverClient = stream_chat_1.StreamChat.getInstance(STREAM_API_KEY, STREAM_API_SECRET);
exports.default = serverClient;
//# sourceMappingURL=stream.js.map