import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import {
  handleGetVideos,
  handleGetVideoById,
  handleGetStreamUrl,
  handleVideoStream,
} from "./routes/videos";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping pong";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // Video routes
  app.get("/api/videos", handleGetVideos);
  app.get("/api/videos/:id", handleGetVideoById);
  app.get("/api/videos/:id/stream", handleVideoStream);

  return app;
}
