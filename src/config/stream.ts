import { StreamChat } from "stream-chat";
import dotenv from "dotenv";

dotenv.config();

const { STREAM_API_KEY, STREAM_API_SECRET } = process.env;

const serverClient = StreamChat.getInstance(STREAM_API_KEY!, STREAM_API_SECRET);

export default serverClient;
